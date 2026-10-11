"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { categories, expenses, groceryItems, receiptAliases, receiptImages, receiptItems, receipts } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { MAX_AMOUNT, isISODate, isId } from "@/lib/form";
import { cleanName, nameKey } from "@/lib/lists";
import {
  ensureSharedCategories,
  findOrCreateLabel,
  findOrCreatePersonalCategory,
  findOrCreateSubcategory,
} from "@/lib/data/lists";
import { aliasKey, cleanReadLines, decodeReceiptImage, prepareReceipt } from "@/lib/receipts/server";
import type { ReceiptDraft, ScanResult } from "@/lib/receipts/types";

export type ReadReceiptResult = { error?: string; scan?: ScanResult };
export type SaveReceiptResult = { error?: string; receiptId?: string; expenseCount?: number };

const cents = (n: number) => Math.round(n * 100);
const MAX_ITEMS = 150;

/**
 * The phone reads the photo and sends the text lines here; this works out
 * the store, date, total and items, and suggests a category for each line.
 */
export async function readReceipt(read: unknown): Promise<ReadReceiptResult> {
  const { user, household } = await requireSession();
  const lines = cleanReadLines(read);
  if (!lines) return { error: "That photo couldn't be read. Try again with the whole receipt in the picture." };
  return { scan: await prepareReceipt(household.id, user.id, lines) };
}

const text = (value: unknown, max = 200) => (typeof value === "string" ? cleanName(value).slice(0, max) : "");

/**
 * Saves a reviewed receipt: one expense per category it covers (so budgets
 * and filters see it), every line kept as a receipt item, the photo, and
 * what each line turned out to be, remembered for next time.
 */
export async function saveReceipt(draft: ReceiptDraft): Promise<SaveReceiptResult> {
  const { user, household } = await requireSession();
  if (!draft || typeof draft !== "object") return { error: "Nothing to save." };
  const personal = draft.scope === "personal";
  const store = text(draft.store);
  const total = Number(draft.total);
  if (!Array.isArray(draft.items) || draft.items.length > MAX_ITEMS) return { error: "That's too many items for one receipt." };
  const items = draft.items
    .map((i) => ({
      raw: text(i?.raw, 300),
      name: text(i?.name),
      quantity: Number(i?.quantity) || 1,
      lineTotal: Number(i?.lineTotal),
      category: text(i?.category),
      subcategory: text(i?.subcategory),
    }))
    .filter((i) => i.name || i.lineTotal);

  if (!store) return { error: "Which store was this?" };
  if (!isISODate(draft.date)) return { error: "What date was this receipt?" };
  if (!Number.isFinite(total) || total <= 0 || total > MAX_AMOUNT) return { error: "What did the receipt come to?" };
  if (!items.length) return { error: "Add at least one item." };
  if (items.some((i) => !i.name)) return { error: "Every item needs a name." };
  if (items.some((i) => !Number.isFinite(i.lineTotal) || Math.abs(i.lineTotal) > MAX_AMOUNT)) {
    return { error: "Every item needs a price." };
  }
  if (items.some((i) => !Number.isFinite(i.quantity) || i.quantity <= 0 || i.quantity > 10_000)) {
    return { error: "Check the quantities." };
  }
  if (items.some((i) => !i.category)) return { error: "Every item needs a category." };
  const sum = items.reduce((s, i) => s + cents(i.lineTotal), 0);
  if (sum !== cents(total)) {
    return { error: `The items add up to R${(sum / 100).toFixed(2)}, not the R${total.toFixed(2)} total.` };
  }
  const image = draft.image ? decodeReceiptImage(draft.image) : null;
  if (draft.image && !image) return { error: "The photo couldn't be saved. Try scanning it again." };
  if (!personal) await ensureSharedCategories(household.id);

  const result = await db.transaction(async (tx): Promise<SaveReceiptResult> => {
    // Resolve every category and sub-category first.
    const resolved = [];
    for (const item of items) {
      const category = personal
        ? await findOrCreatePersonalCategory(household.id, item.category, tx)
        : isId(item.category)
          ? (
              await tx
                .select()
                .from(categories)
                .where(
                  and(
                    eq(categories.id, item.category),
                    eq(categories.householdId, household.id),
                    eq(categories.scope, "shared"),
                  ),
                )
                .limit(1)
            )[0]
          : undefined;
      if (!category) return { error: `Pick a category for ${item.name}.` };
      const subcategory = item.subcategory
        ? await findOrCreateSubcategory(household.id, category.id, item.subcategory, tx)
        : null;
      resolved.push({ ...item, categoryId: category.id, subcategoryId: subcategory?.id ?? null });
    }

    const storeLabel = (await findOrCreateLabel(household.id, "store", store, tx))!;
    const [receipt] = await tx
      .insert(receipts)
      .values({
        householdId: household.id,
        ownerUserId: personal ? user.id : null,
        storeId: storeLabel.id,
        date: draft.date,
        total,
        hasImage: !!image,
        userId: user.id,
      })
      .returning();
    if (image) {
      await tx.insert(receiptImages).values({ receiptId: receipt.id, contentType: "image/jpeg", data: image });
    }

    // One expense per category. A category whose lines net to zero or less
    // (say, only a discount) is folded into the biggest one.
    const groups = new Map<string, typeof resolved>();
    for (const item of resolved) groups.set(item.categoryId, [...(groups.get(item.categoryId) ?? []), item]);
    const byTotal = [...groups.entries()].sort(
      (a, b) => b[1].reduce((s, i) => s + i.lineTotal, 0) - a[1].reduce((s, i) => s + i.lineTotal, 0),
    );
    const [biggestId] = byTotal[0];
    for (const [categoryId, group] of byTotal.slice(1)) {
      if (group.reduce((s, i) => s + cents(i.lineTotal), 0) <= 0) {
        groups.get(biggestId)!.push(...group);
        groups.delete(categoryId);
      }
    }

    let position = 0;
    for (const [categoryId, group] of groups) {
      const amount = group.reduce((s, i) => s + cents(i.lineTotal), 0) / 100;
      const subIds = new Set(group.map((i) => i.subcategoryId));
      const sharedSub = subIds.size === 1 ? [...subIds][0] : null;
      const real = group.filter((i) => i.lineTotal > 0);
      const [expense] = await tx
        .insert(expenses)
        .values({
          householdId: household.id,
          ownerUserId: personal ? user.id : null,
          categoryId,
          subcategoryId: sharedSub,
          storeId: storeLabel.id,
          receiptId: receipt.id,
          userId: user.id,
          amount,
          date: draft.date,
          description:
            real.length === 1 ? real[0].name : `${store} receipt · ${real.length} item${real.length === 1 ? "" : "s"}`,
        })
        .returning();

      await tx.insert(receiptItems).values(
        group.map((item) => ({
          receiptId: receipt.id,
          expenseId: expense.id,
          raw: item.raw || item.name,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.quantity ? item.lineTotal / item.quantity : item.lineTotal,
          lineTotal: item.lineTotal,
          categoryId: item.categoryId,
          subcategoryId: item.subcategoryId,
          position: position++,
        })),
      );
    }

    // Remember each line for next time, and keep grocery prices current.
    const scope = personal ? "personal" : "shared";
    for (const item of resolved) {
      if (item.raw && item.lineTotal > 0) {
        const key = aliasKey(item.raw);
        if (key) {
          await tx
            .insert(receiptAliases)
            .values({
              householdId: household.id,
              scope,
              key,
              name: item.name,
              categoryId: item.categoryId,
              subcategoryId: item.subcategoryId,
            })
            .onConflictDoUpdate({
              target: [receiptAliases.householdId, receiptAliases.scope, receiptAliases.key],
              set: { name: item.name, categoryId: item.categoryId, subcategoryId: item.subcategoryId },
            });
        }
      }
      if (item.lineTotal > 0 && item.quantity > 0) {
        await tx
          .update(groceryItems)
          .set({ lastPrice: Math.round((item.lineTotal / item.quantity) * 100) / 100 })
          .where(and(eq(groceryItems.householdId, household.id), eq(groceryItems.key, nameKey(item.name))));
      }
    }

    return { receiptId: receipt.id, expenseCount: groups.size };
  });

  if (!result.error) revalidatePath("/", "layout");
  return result;
}

/** Deletes a receipt, the expenses it created, and its photo. */
export async function deleteReceipt(receiptId: string) {
  const { user, household } = await requireSession();
  if (!isId(receiptId)) return;
  const [receipt] = await db.select().from(receipts).where(eq(receipts.id, receiptId)).limit(1);
  if (!receipt || receipt.householdId !== household.id) return;
  if (receipt.ownerUserId && receipt.ownerUserId !== user.id) return;

  await db.transaction(async (tx) => {
    await tx.delete(expenses).where(eq(expenses.receiptId, receiptId));
    // The photo and items go with it (ON DELETE CASCADE).
    await tx.delete(receipts).where(eq(receipts.id, receiptId));
  });
  revalidatePath("/", "layout");
  redirect(receipt.ownerUserId ? `/personal/${receipt.ownerUserId}` : "/budget");
}
