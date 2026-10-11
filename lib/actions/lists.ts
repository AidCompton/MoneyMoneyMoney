"use server";

import { and, count, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  budgetLines,
  categories,
  expenses,
  groceryItems,
  groceryListItems,
  incomes,
  labels,
  savingsTransactions,
  subcategories,
} from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { isId, str } from "@/lib/form";
import { cleanName, nameKey } from "@/lib/lists";
import type { Queryable } from "@/db";

export type ActionState = { error?: string; saved?: boolean; merged?: string };

export type ListKind = "store" | "income_source" | "savings_tag" | "subcategory" | "personal_category" | "grocery_item";

// ---------------------------------------------------------------------------
// Merging: renaming an entry to the name of another entry in the same list
// folds the first into the second, so typos can be cleaned up without losing
// anything that used them.
// ---------------------------------------------------------------------------

async function mergeLabel(q: Queryable, fromId: string, toId: string) {
  await q.update(expenses).set({ storeId: toId }).where(eq(expenses.storeId, fromId));
  await q.update(incomes).set({ sourceId: toId }).where(eq(incomes.sourceId, fromId));
  await q.update(savingsTransactions).set({ tagId: toId }).where(eq(savingsTransactions.tagId, fromId));
  await q.delete(labels).where(eq(labels.id, fromId));
}

async function mergeSubcategory(q: Queryable, fromId: string, toId: string) {
  await q.update(expenses).set({ subcategoryId: toId }).where(eq(expenses.subcategoryId, fromId));
  await q.delete(subcategories).where(eq(subcategories.id, fromId));
}

async function mergeCategory(q: Queryable, fromId: string, toId: string) {
  await q.update(expenses).set({ categoryId: toId }).where(eq(expenses.categoryId, fromId));

  // Budget lines for the same person and month are added together.
  for (const line of await q.select().from(budgetLines).where(eq(budgetLines.categoryId, fromId))) {
    const [target] = await q
      .select()
      .from(budgetLines)
      .where(
        and(
          eq(budgetLines.categoryId, toId),
          eq(budgetLines.month, line.month),
          line.ownerUserId ? eq(budgetLines.ownerUserId, line.ownerUserId) : isNull(budgetLines.ownerUserId),
        ),
      )
      .limit(1);
    if (target) {
      await q.update(budgetLines).set({ amount: target.amount + line.amount }).where(eq(budgetLines.id, target.id));
      await q.delete(budgetLines).where(eq(budgetLines.id, line.id));
    } else {
      await q.update(budgetLines).set({ categoryId: toId }).where(eq(budgetLines.id, line.id));
    }
  }

  // Sub-categories move across, merging with any of the same name.
  for (const sub of await q.select().from(subcategories).where(eq(subcategories.categoryId, fromId))) {
    const [twin] = await q
      .select()
      .from(subcategories)
      .where(and(eq(subcategories.categoryId, toId), eq(subcategories.key, sub.key)))
      .limit(1);
    if (twin) await mergeSubcategory(q, sub.id, twin.id);
    else await q.update(subcategories).set({ categoryId: toId }).where(eq(subcategories.id, sub.id));
  }

  await q.delete(categories).where(eq(categories.id, fromId));
}

async function mergeGroceryItem(q: Queryable, fromId: string, toId: string) {
  await q.update(groceryListItems).set({ itemId: toId }).where(eq(groceryListItems.itemId, fromId));
  await q.delete(groceryItems).where(eq(groceryItems.id, fromId));
}

const LIST_KINDS: ListKind[] = ["store", "income_source", "savings_tag", "subcategory", "personal_category", "grocery_item"];

/** Renames an entry, or merges it into the entry that already has that name. */
export async function renameListEntry(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { household } = await requireSession();
  const kind = str(fd, "kind") as ListKind;
  const id = str(fd, "id");
  const name = cleanName(str(fd, "name"));
  const key = nameKey(name);
  if (!name) return { error: "The name can't be empty." };
  if (!LIST_KINDS.includes(kind) || !isId(id)) return { error: "Not found." };

  const result = await db.transaction(async (tx): Promise<ActionState> => {
    if (kind === "store" || kind === "income_source" || kind === "savings_tag") {
      const [entry] = await tx.select().from(labels).where(eq(labels.id, id)).limit(1);
      if (!entry || entry.householdId !== household.id || entry.kind !== kind) return { error: "Not found." };
      const [twin] = await tx
        .select()
        .from(labels)
        .where(and(eq(labels.householdId, household.id), eq(labels.kind, kind), eq(labels.key, key), ne(labels.id, id)))
        .limit(1);
      if (twin) {
        await mergeLabel(tx, id, twin.id);
        return { merged: twin.name };
      }
      await tx.update(labels).set({ name, key }).where(eq(labels.id, id));
      return { saved: true };
    }

    if (kind === "subcategory") {
      const [entry] = await tx.select().from(subcategories).where(eq(subcategories.id, id)).limit(1);
      if (!entry || entry.householdId !== household.id) return { error: "Not found." };
      const [twin] = await tx
        .select()
        .from(subcategories)
        .where(and(eq(subcategories.categoryId, entry.categoryId), eq(subcategories.key, key), ne(subcategories.id, id)))
        .limit(1);
      if (twin) {
        await mergeSubcategory(tx, id, twin.id);
        return { merged: twin.name };
      }
      await tx.update(subcategories).set({ name, key }).where(eq(subcategories.id, id));
      return { saved: true };
    }

    if (kind === "personal_category") {
      const [entry] = await tx.select().from(categories).where(eq(categories.id, id)).limit(1);
      // The eight shared categories are fixed.
      if (!entry || entry.householdId !== household.id || entry.scope !== "personal") return { error: "Not found." };
      const [twin] = await tx
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.householdId, household.id),
            eq(categories.scope, "personal"),
            eq(categories.key, key),
            ne(categories.id, id),
          ),
        )
        .limit(1);
      if (twin) {
        await mergeCategory(tx, id, twin.id);
        return { merged: twin.name };
      }
      await tx.update(categories).set({ name, key }).where(eq(categories.id, id));
      return { saved: true };
    }

    // grocery_item
    const [entry] = await tx.select().from(groceryItems).where(eq(groceryItems.id, id)).limit(1);
    if (!entry || entry.householdId !== household.id) return { error: "Not found." };
    const [twin] = await tx
      .select()
      .from(groceryItems)
      .where(and(eq(groceryItems.householdId, household.id), eq(groceryItems.key, key), ne(groceryItems.id, id)))
      .limit(1);
    if (twin) {
      await mergeGroceryItem(tx, id, twin.id);
      return { merged: twin.name };
    }
    await tx.update(groceryItems).set({ name, key }).where(eq(groceryItems.id, id));
    return { saved: true };
  });

  if (!result.error) revalidatePath("/", "layout");
  return result;
}

/**
 * Removes an entry. Stores, sources and sub-categories are simply cleared
 * from anything that used them; categories and groceries still in use can't
 * be deleted (merge them into another instead).
 */
export async function deleteListEntry(kind: ListKind, id: string) {
  const { household } = await requireSession();
  if (!LIST_KINDS.includes(kind) || !isId(id)) return;

  if (kind === "store" || kind === "income_source" || kind === "savings_tag") {
    await db.delete(labels).where(and(eq(labels.id, id), eq(labels.householdId, household.id)));
  } else if (kind === "subcategory") {
    await db.delete(subcategories).where(and(eq(subcategories.id, id), eq(subcategories.householdId, household.id)));
  } else if (kind === "personal_category") {
    const [used] = await db.select({ n: count() }).from(expenses).where(eq(expenses.categoryId, id));
    if ((used?.n ?? 0) > 0) return;
    await db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.householdId, household.id), eq(categories.scope, "personal")));
  } else if (kind === "grocery_item") {
    const [used] = await db.select({ n: count() }).from(groceryListItems).where(eq(groceryListItems.itemId, id));
    if ((used?.n ?? 0) > 0) return;
    await db.delete(groceryItems).where(and(eq(groceryItems.id, id), eq(groceryItems.householdId, household.id)));
  }

  revalidatePath("/", "layout");
}
