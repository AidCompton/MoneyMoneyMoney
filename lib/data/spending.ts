import "server-only";
import { and, asc, desc, eq, isNull, like } from "drizzle-orm";
import { db } from "@/db";
import { budgetLines, categories, expenses } from "@/db/schema";
import { budgetRemaining } from "@/lib/calculations";
import { colorForIndex } from "@/lib/categories";
import { monthPattern, shiftMonth } from "@/lib/dates";
import { crossFilter, type Dimension } from "@/lib/facets";
import { ensureSharedCategories } from "./lists";

export type SpendingFilters = { cat?: string; sub?: string; store?: string; who?: string };

/**
 * One month of spending for the shared budget (`ownerUserId` null) or one
 * person's personal budget: what was planned and spent per category, plus
 * the month's expenses narrowed by any active filters.
 */
export async function getSpending({
  householdId,
  ownerUserId,
  month,
  filters = {},
}: {
  householdId: string;
  ownerUserId: string | null;
  month: string;
  filters?: SpendingFilters;
}) {
  const scope = ownerUserId ? "personal" : "shared";
  if (scope === "shared") ensureSharedCategories(householdId);

  const cats = db
    .select()
    .from(categories)
    .where(and(eq(categories.householdId, householdId), eq(categories.scope, scope)))
    .orderBy(asc(categories.colorIndex), asc(categories.createdAt))
    .all();

  const lineOwner = ownerUserId ? eq(budgetLines.ownerUserId, ownerUserId) : isNull(budgetLines.ownerUserId);
  const linesFor = (m: string) =>
    db
      .select()
      .from(budgetLines)
      .where(and(eq(budgetLines.householdId, householdId), lineOwner, eq(budgetLines.month, m)))
      .all();
  const lines = linesFor(month);
  const previousLines = linesFor(shiftMonth(month, -1));

  const rows = await db.query.expenses.findMany({
    where: and(
      eq(expenses.householdId, householdId),
      ownerUserId ? eq(expenses.ownerUserId, ownerUserId) : isNull(expenses.ownerUserId),
      like(expenses.date, monthPattern(month)),
    ),
    orderBy: [desc(expenses.date), desc(expenses.createdAt)],
    with: { category: true, subcategory: true, store: true, user: true },
  });

  const planned = new Map(lines.map((l) => [l.categoryId, l.amount]));
  const spent = new Map<string, number>();
  for (const e of rows) spent.set(e.categoryId, (spent.get(e.categoryId) ?? 0) + e.amount);

  // Shared budgets always show all eight categories. Personal budgets show
  // the categories in use this month.
  const shown =
    scope === "shared" ? cats : cats.filter((c) => (planned.get(c.id) ?? 0) > 0 || (spent.get(c.id) ?? 0) > 0);

  const summary = shown.map((c) => ({
    id: c.id,
    name: c.name,
    color: colorForIndex(c.colorIndex),
    planned: planned.get(c.id) ?? 0,
    spent: spent.get(c.id) ?? 0,
  }));

  // The plan form lists every category this budget has ever used, so a
  // personal category planned last month is there to fill in again.
  let planCategories = summary.map(({ id, name, color }) => ({ id, name, color }));
  if (scope === "personal" && ownerUserId) {
    const everUsed = new Set([
      ...db
        .selectDistinct({ id: budgetLines.categoryId })
        .from(budgetLines)
        .where(eq(budgetLines.ownerUserId, ownerUserId))
        .all()
        .map((r) => r.id),
      ...db
        .selectDistinct({ id: expenses.categoryId })
        .from(expenses)
        .where(eq(expenses.ownerUserId, ownerUserId))
        .all()
        .map((r) => r.id),
    ]);
    planCategories = cats
      .filter((c) => everUsed.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, color: colorForIndex(c.colorIndex) }));
  }

  type Row = (typeof rows)[number];
  const dims: Record<string, Dimension<Row>> = {
    cat: {
      value: (e) => e.categoryId,
      label: (e) => e.category.name,
      color: (e) => colorForIndex(e.category.colorIndex),
    },
    sub: { value: (e) => e.subcategoryId, label: (e) => e.subcategory?.name ?? "" },
    store: { value: (e) => e.storeId, label: (e) => e.store?.name ?? "" },
  };
  if (scope === "shared") {
    dims.who = { value: (e) => e.userId, label: (e) => e.user.name };
  }
  const explore = crossFilter(rows, dims, filters, (e) => e.amount);

  const totalPlanned = lines.reduce((sum, l) => sum + l.amount, 0);
  const totalSpent = rows.reduce((sum, e) => sum + e.amount, 0);

  return {
    scope,
    categories: summary,
    planCategories,
    planned: Object.fromEntries(planned),
    previousPlanned: Object.fromEntries(previousLines.map((l) => [l.categoryId, l.amount])),
    totalPlanned,
    totalSpent,
    remaining: budgetRemaining(totalPlanned, totalSpent),
    expenseCount: rows.length,
    expenses: explore.filtered.map((e) => ({
      id: e.id,
      amount: e.amount,
      date: e.date,
      description: e.description,
      categoryName: e.category.name,
      color: colorForIndex(e.category.colorIndex),
      subcategoryName: e.subcategory?.name ?? null,
      storeName: e.store?.name ?? null,
      userName: e.user.name,
      userId: e.userId,
    })),
    facets: explore.facets,
    activeFilters: explore.active,
    filteredTotal: explore.total,
  };
}

export type Spending = Awaited<ReturnType<typeof getSpending>>;
