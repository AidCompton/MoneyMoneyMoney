import "server-only";
import { and, asc, desc, eq, isNull, like, lt } from "drizzle-orm";
import { db } from "@/db";
import { budgetLines, categories, expenses, groceryListItems, mealPreps } from "@/db/schema";
import { costPerDinner, groceryLineTotal, groceryTotals } from "@/lib/calculations";
import { FOOD_CATEGORY } from "@/lib/categories";
import { monthPattern } from "@/lib/dates";
import { nameKey } from "@/lib/lists";
import { ensureSharedCategories, getGroceryItemOptions } from "./lists";

export async function getGroceryMonth(householdId: string, month: string) {
  const preps = db
    .select()
    .from(mealPreps)
    .where(and(eq(mealPreps.householdId, householdId), eq(mealPreps.month, month)))
    .orderBy(asc(mealPreps.createdAt))
    .all();

  const lines = await db.query.groceryListItems.findMany({
    where: and(eq(groceryListItems.householdId, householdId), eq(groceryListItems.month, month)),
    orderBy: [asc(groceryListItems.createdAt)],
    with: { item: true },
  });

  const toLine = (l: (typeof lines)[number]) => ({
    id: l.id,
    itemName: l.item.name,
    size: l.size,
    quantity: l.quantity,
    price: l.price,
    total: groceryLineTotal(l.quantity, l.price),
    comment: l.comment,
    bought: l.bought,
    mealPrepId: l.mealPrepId,
  });

  const general = lines.filter((l) => !l.mealPrepId).map(toLine);
  const mealPrepSections = preps
    // Meals with a cook date come first, in date order.
    .sort((a, b) => (a.cookOn ?? "9999").localeCompare(b.cookOn ?? "9999"))
    .map((p) => {
      const items = lines.filter((l) => l.mealPrepId === p.id).map(toLine);
      const totals = groceryTotals(items);
      return {
        id: p.id,
        name: p.name,
        dinners: p.dinners,
        cookOn: p.cookOn,
        notes: p.notes,
        items,
        totals,
        perDinner: costPerDinner(totals.planned, p.dinners),
      };
    });

  // Past meal preps you can plan again. The newest version of each is the one
  // that gets copied.
  const pastPreps = db
    .select({ name: mealPreps.name, key: mealPreps.key })
    .from(mealPreps)
    .where(eq(mealPreps.householdId, householdId))
    .orderBy(desc(mealPreps.createdAt))
    .all();
  const mealPrepOptions = [...new Map(pastPreps.map((p) => [p.key, p.name])).values()].sort((a, b) =>
    a.localeCompare(b),
  );

  // The shared Food & Toiletries budget this list is spending from.
  ensureSharedCategories(householdId);
  const food = db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.householdId, householdId),
        eq(categories.scope, "shared"),
        eq(categories.key, nameKey(FOOD_CATEGORY)),
      ),
    )
    .get();
  const foodPlanned = food
    ? (db
        .select({ amount: budgetLines.amount })
        .from(budgetLines)
        .where(
          and(
            eq(budgetLines.categoryId, food.id),
            eq(budgetLines.month, month),
            isNull(budgetLines.ownerUserId),
          ),
        )
        .get()?.amount ?? 0)
    : 0;
  const foodSpent = food
    ? db
        .select({ amount: expenses.amount })
        .from(expenses)
        .where(
          and(
            eq(expenses.categoryId, food.id),
            isNull(expenses.ownerUserId),
            like(expenses.date, monthPattern(month)),
          ),
        )
        .all()
        .reduce((sum, e) => sum + e.amount, 0)
    : 0;

  // The most recent earlier month with a general list, for "start from last month".
  const previous = db
    .select({ month: groceryListItems.month })
    .from(groceryListItems)
    .where(
      and(
        eq(groceryListItems.householdId, householdId),
        isNull(groceryListItems.mealPrepId),
        lt(groceryListItems.month, month),
      ),
    )
    .orderBy(desc(groceryListItems.month))
    .get();

  return {
    general,
    generalTotals: groceryTotals(general),
    mealPreps: mealPrepSections,
    totals: groceryTotals(lines.map(toLine)),
    itemOptions: getGroceryItemOptions(householdId),
    mealPrepOptions,
    food: { planned: foodPlanned, spent: foodSpent },
    previousMonth: previous?.month ?? null,
  };
}

export type GroceryMonth = Awaited<ReturnType<typeof getGroceryMonth>>;
