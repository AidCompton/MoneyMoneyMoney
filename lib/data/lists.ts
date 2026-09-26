import "server-only";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  subcategories,
  labels,
  groceryItems,
  groceryListItems,
  expenses,
  incomes,
  savingsTransactions,
  budgetLines,
} from "@/db/schema";
import { SHARED_CATEGORIES, colorForIndex } from "@/lib/categories";
import { cleanName, nameKey, type LabelKind } from "@/lib/lists";

/** Anything that can run queries: the db itself or a transaction. */
export type Queryable = Pick<typeof db, "select" | "insert" | "update" | "delete">;

// ---------------------------------------------------------------------------
// Find-or-create: typing a name that already exists (in any capitalisation)
// reuses it, so each pick list only ever holds one of everything.
// ---------------------------------------------------------------------------

export function ensureSharedCategories(householdId: string, q: Queryable = db) {
  const existing = q
    .select({ n: count() })
    .from(categories)
    .where(and(eq(categories.householdId, householdId), eq(categories.scope, "shared")))
    .get();
  if ((existing?.n ?? 0) >= SHARED_CATEGORIES.length) return;
  q.insert(categories)
    .values(
      SHARED_CATEGORIES.map((name, i) => ({
        householdId,
        scope: "shared" as const,
        name,
        key: nameKey(name),
        colorIndex: i,
      })),
    )
    .onConflictDoNothing()
    .run();
}

export function findOrCreatePersonalCategory(householdId: string, raw: string, q: Queryable = db) {
  const name = cleanName(raw);
  if (!name) return null;
  const key = nameKey(name);
  const existing = q
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.householdId, householdId),
        eq(categories.scope, "personal"),
        eq(categories.key, key),
      ),
    )
    .get();
  if (existing) return existing;

  // Colour slots are handed out in creation order, so the first eight
  // personal categories never share a colour.
  const taken = q
    .select({ n: count() })
    .from(categories)
    .where(and(eq(categories.householdId, householdId), eq(categories.scope, "personal")))
    .get();
  return q
    .insert(categories)
    .values({ householdId, scope: "personal", name, key, colorIndex: taken?.n ?? 0 })
    .returning()
    .get();
}

export function findOrCreateSubcategory(
  householdId: string,
  categoryId: string,
  raw: string,
  q: Queryable = db,
) {
  const name = cleanName(raw);
  if (!name) return null;
  const key = nameKey(name);
  const existing = q
    .select()
    .from(subcategories)
    .where(and(eq(subcategories.categoryId, categoryId), eq(subcategories.key, key)))
    .get();
  if (existing) return existing;
  return q.insert(subcategories).values({ householdId, categoryId, name, key }).returning().get();
}

export function findOrCreateLabel(householdId: string, kind: LabelKind, raw: string, q: Queryable = db) {
  const name = cleanName(raw);
  if (!name) return null;
  const key = nameKey(name);
  const existing = q
    .select()
    .from(labels)
    .where(and(eq(labels.householdId, householdId), eq(labels.kind, kind), eq(labels.key, key)))
    .get();
  if (existing) return existing;
  return q.insert(labels).values({ householdId, kind, name, key }).returning().get();
}

export function findOrCreateGroceryItem(householdId: string, raw: string, q: Queryable = db) {
  const name = cleanName(raw);
  if (!name) return null;
  const key = nameKey(name);
  const existing = q
    .select()
    .from(groceryItems)
    .where(and(eq(groceryItems.householdId, householdId), eq(groceryItems.key, key)))
    .get();
  if (existing) return existing;
  return q.insert(groceryItems).values({ householdId, name, key }).returning().get();
}

// ---------------------------------------------------------------------------
// Options for the dropdowns
// ---------------------------------------------------------------------------

export type CategoryOption = { id: string; name: string; color: string };

export function getCategoryOptions(householdId: string, scope: "shared" | "personal"): CategoryOption[] {
  if (scope === "shared") ensureSharedCategories(householdId);
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.householdId, householdId), eq(categories.scope, scope)))
    .orderBy(asc(categories.colorIndex), asc(categories.createdAt))
    .all()
    .map((c) => ({ id: c.id, name: c.name, color: colorForIndex(c.colorIndex) }));
}

/** Sub-category names for each category, keyed by the category's name key. */
export function getSubcategoryOptions(householdId: string, scope: "shared" | "personal") {
  const rows = db
    .select({ name: subcategories.name, categoryName: categories.name })
    .from(subcategories)
    .innerJoin(categories, eq(categories.id, subcategories.categoryId))
    .where(and(eq(subcategories.householdId, householdId), eq(categories.scope, scope)))
    .orderBy(asc(subcategories.name))
    .all();
  const byCategory: Record<string, string[]> = {};
  for (const row of rows) {
    (byCategory[nameKey(row.categoryName)] ??= []).push(row.name);
  }
  return byCategory;
}

export function getLabelOptions(householdId: string, kind: LabelKind) {
  return db
    .select({ name: labels.name })
    .from(labels)
    .where(and(eq(labels.householdId, householdId), eq(labels.kind, kind)))
    .orderBy(asc(labels.name))
    .all()
    .map((l) => l.name);
}

export function getGroceryItemOptions(householdId: string) {
  return db
    .select({ name: groceryItems.name, size: groceryItems.lastSize, price: groceryItems.lastPrice })
    .from(groceryItems)
    .where(eq(groceryItems.householdId, householdId))
    .orderBy(asc(groceryItems.name))
    .all();
}

// ---------------------------------------------------------------------------
// Everything, with how often it's used, for the Lists page
// ---------------------------------------------------------------------------

function countBy<T extends string | null>(rows: { key: T; n: number }[]) {
  return new Map(rows.filter((r) => r.key !== null).map((r) => [r.key as string, r.n]));
}

export function getListsForManagement(householdId: string) {
  ensureSharedCategories(householdId);

  const cats = db
    .select()
    .from(categories)
    .where(eq(categories.householdId, householdId))
    .orderBy(asc(categories.scope), asc(categories.colorIndex), asc(categories.name))
    .all();
  const catIds = cats.map((c) => c.id);

  const categoryUse = countBy(
    db
      .select({ key: expenses.categoryId, n: count() })
      .from(expenses)
      .where(eq(expenses.householdId, householdId))
      .groupBy(expenses.categoryId)
      .all(),
  );
  const lineUse = countBy(
    catIds.length
      ? db
          .select({ key: budgetLines.categoryId, n: count() })
          .from(budgetLines)
          .where(inArray(budgetLines.categoryId, catIds))
          .groupBy(budgetLines.categoryId)
          .all()
      : [],
  );

  const subs = db
    .select()
    .from(subcategories)
    .where(eq(subcategories.householdId, householdId))
    .orderBy(asc(subcategories.name))
    .all();
  const subUse = countBy(
    db
      .select({ key: expenses.subcategoryId, n: count() })
      .from(expenses)
      .where(eq(expenses.householdId, householdId))
      .groupBy(expenses.subcategoryId)
      .all(),
  );

  const labelRows = db
    .select()
    .from(labels)
    .where(eq(labels.householdId, householdId))
    .orderBy(asc(labels.name))
    .all();
  const storeUse = countBy(
    db
      .select({ key: expenses.storeId, n: count() })
      .from(expenses)
      .where(eq(expenses.householdId, householdId))
      .groupBy(expenses.storeId)
      .all(),
  );
  const sourceUse = countBy(
    db
      .select({ key: incomes.sourceId, n: count() })
      .from(incomes)
      .where(eq(incomes.householdId, householdId))
      .groupBy(incomes.sourceId)
      .all(),
  );
  const tagUse = countBy(
    db
      .select({ key: savingsTransactions.tagId, n: count() })
      .from(savingsTransactions)
      .groupBy(savingsTransactions.tagId)
      .all(),
  );

  const items = db
    .select()
    .from(groceryItems)
    .where(eq(groceryItems.householdId, householdId))
    .orderBy(asc(groceryItems.name))
    .all();
  const itemUse = countBy(
    db
      .select({ key: groceryListItems.itemId, n: count() })
      .from(groceryListItems)
      .where(eq(groceryListItems.householdId, householdId))
      .groupBy(groceryListItems.itemId)
      .all(),
  );

  const labelUse = { store: storeUse, income_source: sourceUse, savings_tag: tagUse } as const;

  return {
    categories: cats.map((c) => ({
      id: c.id,
      name: c.name,
      scope: c.scope,
      color: colorForIndex(c.colorIndex),
      uses: categoryUse.get(c.id) ?? 0,
      planned: lineUse.get(c.id) ?? 0,
      subcategories: subs
        .filter((s) => s.categoryId === c.id)
        .map((s) => ({ id: s.id, name: s.name, uses: subUse.get(s.id) ?? 0 })),
    })),
    labels: labelRows.map((l) => ({
      id: l.id,
      kind: l.kind,
      name: l.name,
      uses: labelUse[l.kind].get(l.id) ?? 0,
    })),
    groceryItems: items.map((i) => ({
      id: i.id,
      name: i.name,
      size: i.lastSize,
      price: i.lastPrice,
      uses: itemUse.get(i.id) ?? 0,
    })),
  };
}
