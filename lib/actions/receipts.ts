"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { categories, expenses, groceryItems, receiptAliases, receiptItems, receipts } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { isISODate } from "@/lib/form";
import { cleanName, nameKey } from "@/lib/lists";
import {
  ensureSharedCategories,
  findOrCreateLabel,
  findOrCreatePersonalCategory,
  findOrCreateSubcategory,
} from "@/lib/data/lists";
import { aliasKey, keepReceiptImage, removeReceiptImage } from "@/lib/receipts/server";
import type { ReceiptDraft } from "@/lib/receipts/types";

export type SaveReceiptResult = { error?: string; receiptId?: string; expenseCount?: number };

const cents = (n: number) => Math.round(n * 100);

/**
 * Saves a reviewed receipt: one expense per category it covers (so budgets
 * and filters see it), every line kept as a receipt item, and what each line
 * turned out to be remembered for next time.
 */
export async function saveReceipt(draft: ReceiptDraft): Promise<SaveReceiptResult> {
  const { user, household } = await requireSession();
  const personal = draft.scope === "personal";
  const store = cleanName(draft.store ?? "");
  const items = (draft.items ?? [])
    .map((i) => ({ ...i, name: cleanName(i.name ?? ""), quantity: Number(i.quantity) || 1, lineTotal: Number(i.lineTotal) }))
    .filter((i) => i.name || i.lineTotal);

  if (!store) return { error: "Which store was this?" };
  if (!isISODate(draft.date)) return { error: "What date was this receipt?" };
  if (!Number.isFinite(draft.total) || draft.total <= 0) return { error: "What did the receipt come to?" };
  if (!items.length) return { error: "Add at least one item." };
  if (items.some((i) => !i.name)) return { error: "Every item needs a name." };
  if (items.some((i) => !Number.isFinite(i.lineTotal))) return { error: "Every item needs a price." };
  if (items.some((i) => !i.category)) return { error: "Every item needs a category." };
  const sum = items.reduce((s, i) => s + cents(i.lineTotal), 0);
  if (sum !== cents(draft.total)) {
    return { error: `The items add up to R${(sum / 100).toFixed(2)}, not the R${draft.total.toFixed(2)} total.` };
  }
  if (!personal) ensureSharedCategories(household.id);

  const result = db.transaction((tx): SaveReceiptResult => {
    // Resolve every category and sub-category first.
    const resolved = [];
    for (const item of items) {
      const category = personal
        ? findOrCreatePersonalCategory(household.id, item.category, tx)
        : tx
            .select()
            .from(categories)
            .where(
              and(
                eq(categories.id, item.category),
                eq(categories.householdId, household.id),
                eq(categories.scope, "shared"),
              ),
            )
            .get();
      if (!category) return { error: `Pick a category for ${item.name}.` };
      const subcategory = item.subcategory ? findOrCreateSubcategory(household.id, category.id, item.subcategory, tx) : null;
      resolved.push({ ...item, categoryId: category.id, subcategoryId: subcategory?.id ?? null, subName: subcategory?.name });
    }

    const storeLabel = findOrCreateLabel(household.id, "store", store, tx)!;
    const receipt = tx
      .insert(receipts)
      .values({
        householdId: household.id,
        ownerUserId: personal ? user.id : null,
        storeId: storeLabel.id,
        date: draft.date,
        total: draft.total,
        userId: user.id,
      })
      .returning()
      .get();

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
      const expense = tx
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
        .returning()
        .get();

      for (const item of group) {
        tx.insert(receiptItems)
          .values({
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
          })
          .run();
      }
    }

    // Remember each line for next time, and keep grocery prices current.
    const scope = personal ? "personal" : "shared";
    for (const item of resolved) {
      if (item.raw && item.lineTotal > 0) {
        const key = aliasKey(item.raw);
        if (key) {
          tx.insert(receiptAliases)
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
            })
            .run();
        }
      }
      if (item.lineTotal > 0 && item.quantity > 0) {
        tx.update(groceryItems)
          .set({ lastPrice: Math.round((item.lineTotal / item.quantity) * 100) / 100 })
          .where(and(eq(groceryItems.householdId, household.id), eq(groceryItems.key, nameKey(item.name))))
          .run();
      }
    }

    return { receiptId: receipt.id, expenseCount: groups.size };
  });

  if (result.receiptId && keepReceiptImage(draft.token, result.receiptId)) {
    db.update(receipts).set({ hasImage: true }).where(eq(receipts.id, result.receiptId)).run();
  }
  if (!result.error) revalidatePath("/", "layout");
  return result;
}

/** Deletes a receipt, the expenses it created, and its photo. */
export async function deleteReceipt(receiptId: string) {
  const { user, household } = await requireSession();
  const receipt = db.select().from(receipts).where(eq(receipts.id, receiptId)).get();
  if (!receipt || receipt.householdId !== household.id) return;
  if (receipt.ownerUserId && receipt.ownerUserId !== user.id) return;

  db.transaction((tx) => {
    tx.delete(expenses).where(eq(expenses.receiptId, receiptId)).run();
    tx.delete(receipts).where(eq(receipts.id, receiptId)).run();
  });
  removeReceiptImage(receiptId);
  revalidatePath("/", "layout");
  redirect(receipt.ownerUserId ? `/personal/${receipt.ownerUserId}` : "/budget");
}
