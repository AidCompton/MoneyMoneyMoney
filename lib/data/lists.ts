import "server-only";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db, type Queryable } from "@/db";
import {
  categories,
  subcategories,
  labels,
  groceryItems,
  groceryListItems,
  expenses,
  incomes,
  savingsAccounts,
  savingsTransactions,
  budgetLines,
} from "@/db/schema";
import { SHARED_CATEGORIES, colorForIndex } from "@/lib/categories";
import { cleanName, nameKey, type LabelKind } from "@/lib/lists";

export type { Queryable };

// ---------------------------------------------------------------------------
// Find-or-create: typing a name that already exists (in any capitalisation)
// reuses it, so each pick list only ever holds one of everything. Inserts use
// ON CONFLICT against the unique (household, key) indexes, so two people
// adding the same new name at the same moment still end up with one entry.
// ---------------------------------------------------------------------------

export async function ensureSharedCategories(householdId: string, q: Queryable = db) {
  const [existing] = await q
    .select({ n: count() })
    .from(categories)
    .where(and(eq(categories.householdId, householdId), eq(categories.scope, "shared")));
  if ((existing?.n ?? 0) >= SHARED_CATEGORIES.length) return;
  await q
    .insert(categories)
    .values(
      SHARED_CATEGORIES.map((name, i) => ({
        householdId,
        scope: "shared" as const,
        name,
        key: nameKey(name),
        colorIndex: i,
      })),
    )
    .onConflictDoNothing();
}

export async function findOrCreatePersonalCategory(householdId: string, raw: string, q: Queryable = db) {
  const name = cleanName(raw);
  if (!name) return null;
  const key = nameKey(name);
  const where = and(eq(categories.householdId, householdId), eq(categories.scope, "personal"), eq(categories.key, key));
  const [existing] = await q.select().from(categories).where(where).limit(1);
  if (existing) return existing;

  // Colour slots are handed out in creation order, so the first eight
  // personal categories never share a colour.
  const [taken] = await q
    .select({ n: count() })
    .from(categories)
    .where(and(eq(categories.householdId, householdId), eq(categories.scope, "personal")));
  const [created] = await q
    .insert(categories)
    .values({ householdId, scope: "personal", name, key, colorIndex: taken?.n ?? 0 })
    .onConflictDoNothing()
    .returning();
  return created ?? (await q.select().from(categories).where(where).limit(1))[0] ?? null;
}

export async function findOrCreateSubcategory(householdId: string, categoryId: string, raw: string, q: Queryable = db) {
  const name = cleanName(raw);
  if (!name) return null;
  const key = nameKey(name);
  const where = and(eq(subcategories.categoryId, categoryId), eq(subcategories.key, key));
  const [existing] = await q.select().from(subcategories).where(where).limit(1);
  if (existing) return existing;
  const [created] = await q
    .insert(subcategories)
    .values({ householdId, categoryId, name, key })
    .onConflictDoNothing()
    .returning();
  return created ?? (await q.select().from(subcategories).where(where).limit(1))[0] ?? null;
}

export async function findOrCreateLabel(householdId: string, kind: LabelKind, raw: string, q: Queryable = db) {
  const name = cleanName(raw);
  if (!name) return null;
  const key = nameKey(name);
  const where = and(eq(labels.householdId, householdId), eq(labels.kind, kind), eq(labels.key, key));
  const [existing] = await q.select().from(labels).where(where).limit(1);
  if (existing) return existing;
  const [created] = await q.insert(labels).values({ householdId, kind, name, key }).onConflictDoNothing().returning();
  return created ?? (await q.select().from(labels).where(where).limit(1))[0] ?? null;
}

export async function findOrCreateGroceryItem(householdId: string, raw: string, q: Queryable = db) {
  const name = cleanName(raw);
  if (!name) return null;
  const key = nameKey(name);
  const where = and(eq(groceryItems.householdId, householdId), eq(groceryItems.key, key));
  const [existing] = await q.select().from(groceryItems).where(where).limit(1);
  if (existing) return existing;
  const [created] = await q.insert(groceryItems).values({ householdId, name, key }).onConflictDoNothing().returning();
  return created ?? (await q.select().from(groceryItems).where(where).limit(1))[0] ?? null;
}

// ---------------------------------------------------------------------------
// Options for the dropdowns
// ---------------------------------------------------------------------------

export type CategoryOption = { id: string; name: string; color: string };

export async function getCategoryOptions(householdId: string, scope: "shared" | "personal"): Promise<CategoryOption[]> {
  if (scope === "shared") await ensureSharedCategories(householdId);
  const rows = await db
    .select()
    .from(categories)
    .where(and(eq(categories.householdId, householdId), eq(categories.scope, scope)))
    .orderBy(asc(categories.colorIndex), asc(categories.createdAt));
  return rows.map((c) => ({ id: c.id, name: c.name, color: colorForIndex(c.colorIndex) }));
}

/** Sub-category names for each category, keyed by the category's name key. */
export async function getSubcategoryOptions(householdId: string, scope: "shared" | "personal") {
  const rows = await db
    .select({ name: subcategories.name, categoryName: categories.name })
    .from(subcategories)
    .innerJoin(categories, eq(categories.id, subcategories.categoryId))
    .where(and(eq(subcategories.householdId, householdId), eq(categories.scope, scope)))
    .orderBy(asc(subcategories.name));
  const byCategory: Record<string, string[]> = {};
  for (const row of rows) {
    (byCategory[nameKey(row.categoryName)] ??= []).push(row.name);
  }
  return byCategory;
}

export async function getLabelOptions(householdId: string, kind: LabelKind) {
  const rows = await db
    .select({ name: labels.name })
    .from(labels)
    .where(and(eq(labels.householdId, householdId), eq(labels.kind, kind)))
    .orderBy(asc(labels.name));
  return rows.map((l) => l.name);
}

export async function getGroceryItemOptions(householdId: string) {
  return db
    .select({ name: groceryItems.name, size: groceryItems.lastSize, price: groceryItems.lastPrice })
    .from(groceryItems)
    .where(eq(groceryItems.householdId, householdId))
    .orderBy(asc(groceryItems.name));
}

// ---------------------------------------------------------------------------
// Everything, with how often it's used, for the Lists page
// ---------------------------------------------------------------------------

function countBy<T extends string | null>(rows: { key: T; n: number }[]) {
  return new Map(rows.filter((r) => r.key !== null).map((r) => [r.key as string, r.n]));
}

export async function getListsForManagement(householdId: string) {
  await ensureSharedCategories(householdId);

  const [cats, subs, labelRows, items] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(eq(categories.householdId, householdId))
      .orderBy(asc(categories.scope), asc(categories.colorIndex), asc(categories.name)),
    db.select().from(subcategories).where(eq(subcategories.householdId, householdId)).orderBy(asc(subcategories.name)),
    db.select().from(labels).where(eq(labels.householdId, householdId)).orderBy(asc(labels.name)),
    db.select().from(groceryItems).where(eq(groceryItems.householdId, householdId)).orderBy(asc(groceryItems.name)),
  ]);
  const catIds = cats.map((c) => c.id);

  const [categoryUse, lineUse, subUse, storeUse, sourceUse, tagUse, itemUse] = (
    await Promise.all([
      db
        .select({ key: expenses.categoryId, n: count() })
        .from(expenses)
        .where(eq(expenses.householdId, householdId))
        .groupBy(expenses.categoryId),
      catIds.length
        ? db
            .select({ key: budgetLines.categoryId, n: count() })
            .from(budgetLines)
            .where(inArray(budgetLines.categoryId, catIds))
            .groupBy(budgetLines.categoryId)
        : Promise.resolve([]),
      db
        .select({ key: expenses.subcategoryId, n: count() })
        .from(expenses)
        .where(eq(expenses.householdId, householdId))
        .groupBy(expenses.subcategoryId),
      db
        .select({ key: expenses.storeId, n: count() })
        .from(expenses)
        .where(eq(expenses.householdId, householdId))
        .groupBy(expenses.storeId),
      db
        .select({ key: incomes.sourceId, n: count() })
        .from(incomes)
        .where(eq(incomes.householdId, householdId))
        .groupBy(incomes.sourceId),
      db
        .select({ key: savingsTransactions.tagId, n: count() })
        .from(savingsTransactions)
        .innerJoin(savingsAccounts, eq(savingsAccounts.id, savingsTransactions.accountId))
        .where(eq(savingsAccounts.householdId, householdId))
        .groupBy(savingsTransactions.tagId),
      db
        .select({ key: groceryListItems.itemId, n: count() })
        .from(groceryListItems)
        .where(eq(groceryListItems.householdId, householdId))
        .groupBy(groceryListItems.itemId),
    ])
  ).map((rows) => countBy(rows as { key: string | null; n: number }[]));

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
