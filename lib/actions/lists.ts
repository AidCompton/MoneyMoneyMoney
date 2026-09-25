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
import { cleanName, nameKey } from "@/lib/lists";
import type { Queryable } from "@/lib/data/lists";

export type ActionState = { error?: string; saved?: boolean; merged?: string };

export type ListKind = "store" | "income_source" | "savings_tag" | "subcategory" | "personal_category" | "grocery_item";

// ---------------------------------------------------------------------------
// Merging: renaming an entry to the name of another entry in the same list
// folds the first into the second, so typos can be cleaned up without losing
// anything that used them.
// ---------------------------------------------------------------------------

function mergeLabel(q: Queryable, fromId: string, toId: string) {
  q.update(expenses).set({ storeId: toId }).where(eq(expenses.storeId, fromId)).run();
  q.update(incomes).set({ sourceId: toId }).where(eq(incomes.sourceId, fromId)).run();
  q.update(savingsTransactions).set({ tagId: toId }).where(eq(savingsTransactions.tagId, fromId)).run();
  q.delete(labels).where(eq(labels.id, fromId)).run();
}

function mergeSubcategory(q: Queryable, fromId: string, toId: string) {
  q.update(expenses).set({ subcategoryId: toId }).where(eq(expenses.subcategoryId, fromId)).run();
  q.delete(subcategories).where(eq(subcategories.id, fromId)).run();
}

function mergeCategory(q: Queryable, fromId: string, toId: string) {
  q.update(expenses).set({ categoryId: toId }).where(eq(expenses.categoryId, fromId)).run();

  // Budget lines for the same person and month are added together.
  for (const line of q.select().from(budgetLines).where(eq(budgetLines.categoryId, fromId)).all()) {
    const target = q
      .select()
      .from(budgetLines)
      .where(
        and(
          eq(budgetLines.categoryId, toId),
          eq(budgetLines.month, line.month),
          line.ownerUserId ? eq(budgetLines.ownerUserId, line.ownerUserId) : isNull(budgetLines.ownerUserId),
        ),
      )
      .get();
    if (target) {
      q.update(budgetLines).set({ amount: target.amount + line.amount }).where(eq(budgetLines.id, target.id)).run();
      q.delete(budgetLines).where(eq(budgetLines.id, line.id)).run();
    } else {
      q.update(budgetLines).set({ categoryId: toId }).where(eq(budgetLines.id, line.id)).run();
    }
  }

  // Sub-categories move across, merging with any of the same name.
  for (const sub of q.select().from(subcategories).where(eq(subcategories.categoryId, fromId)).all()) {
    const twin = q
      .select()
      .from(subcategories)
      .where(and(eq(subcategories.categoryId, toId), eq(subcategories.key, sub.key)))
      .get();
    if (twin) mergeSubcategory(q, sub.id, twin.id);
    else q.update(subcategories).set({ categoryId: toId }).where(eq(subcategories.id, sub.id)).run();
  }

  q.delete(categories).where(eq(categories.id, fromId)).run();
}

function mergeGroceryItem(q: Queryable, fromId: string, toId: string) {
  q.update(groceryListItems).set({ itemId: toId }).where(eq(groceryListItems.itemId, fromId)).run();
  q.delete(groceryItems).where(eq(groceryItems.id, fromId)).run();
}

/** Renames an entry, or merges it into the entry that already has that name. */
export async function renameListEntry(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { household } = await requireSession();
  const kind = String(fd.get("kind") ?? "") as ListKind;
  const id = String(fd.get("id") ?? "");
  const name = cleanName(String(fd.get("name") ?? ""));
  const key = nameKey(name);
  if (!name) return { error: "The name can't be empty." };

  const result = db.transaction((tx): ActionState => {
    if (kind === "store" || kind === "income_source" || kind === "savings_tag") {
      const entry = tx.select().from(labels).where(eq(labels.id, id)).get();
      if (!entry || entry.householdId !== household.id || entry.kind !== kind) return { error: "Not found." };
      const twin = tx
        .select()
        .from(labels)
        .where(and(eq(labels.householdId, household.id), eq(labels.kind, kind), eq(labels.key, key), ne(labels.id, id)))
        .get();
      if (twin) {
        mergeLabel(tx, id, twin.id);
        return { merged: twin.name };
      }
      tx.update(labels).set({ name, key }).where(eq(labels.id, id)).run();
      return { saved: true };
    }

    if (kind === "subcategory") {
      const entry = tx.select().from(subcategories).where(eq(subcategories.id, id)).get();
      if (!entry || entry.householdId !== household.id) return { error: "Not found." };
      const twin = tx
        .select()
        .from(subcategories)
        .where(and(eq(subcategories.categoryId, entry.categoryId), eq(subcategories.key, key), ne(subcategories.id, id)))
        .get();
      if (twin) {
        mergeSubcategory(tx, id, twin.id);
        return { merged: twin.name };
      }
      tx.update(subcategories).set({ name, key }).where(eq(subcategories.id, id)).run();
      return { saved: true };
    }

    if (kind === "personal_category") {
      const entry = tx.select().from(categories).where(eq(categories.id, id)).get();
      // The eight shared categories are fixed.
      if (!entry || entry.householdId !== household.id || entry.scope !== "personal") return { error: "Not found." };
      const twin = tx
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
        .get();
      if (twin) {
        mergeCategory(tx, id, twin.id);
        return { merged: twin.name };
      }
      tx.update(categories).set({ name, key }).where(eq(categories.id, id)).run();
      return { saved: true };
    }

    if (kind === "grocery_item") {
      const entry = tx.select().from(groceryItems).where(eq(groceryItems.id, id)).get();
      if (!entry || entry.householdId !== household.id) return { error: "Not found." };
      const twin = tx
        .select()
        .from(groceryItems)
        .where(and(eq(groceryItems.householdId, household.id), eq(groceryItems.key, key), ne(groceryItems.id, id)))
        .get();
      if (twin) {
        mergeGroceryItem(tx, id, twin.id);
        return { merged: twin.name };
      }
      tx.update(groceryItems).set({ name, key }).where(eq(groceryItems.id, id)).run();
      return { saved: true };
    }

    return { error: "Unknown list." };
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

  if (kind === "store" || kind === "income_source" || kind === "savings_tag") {
    db.delete(labels).where(and(eq(labels.id, id), eq(labels.householdId, household.id))).run();
  } else if (kind === "subcategory") {
    db.delete(subcategories).where(and(eq(subcategories.id, id), eq(subcategories.householdId, household.id))).run();
  } else if (kind === "personal_category") {
    const used = db.select({ n: count() }).from(expenses).where(eq(expenses.categoryId, id)).get();
    if ((used?.n ?? 0) > 0) return;
    db.delete(categories)
      .where(and(eq(categories.id, id), eq(categories.householdId, household.id), eq(categories.scope, "personal")))
      .run();
  } else if (kind === "grocery_item") {
    const used = db.select({ n: count() }).from(groceryListItems).where(eq(groceryListItems.itemId, id)).get();
    if ((used?.n ?? 0) > 0) return;
    db.delete(groceryItems).where(and(eq(groceryItems.id, id), eq(groceryItems.householdId, household.id))).run();
  }

  revalidatePath("/", "layout");
}
