import "server-only";
import { and, desc, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { incomes, sharedContributions } from "@/db/schema";
import { personalFlow } from "@/lib/calculations";
import { monthPattern } from "@/lib/dates";
import { getSpending, type SpendingFilters } from "./spending";
import { savedInMonth } from "./savings";

/** One person's month: income, personal spending, savings and what they paid into the shared pot. */
export async function getPersonalMonth(
  householdId: string,
  userId: string,
  month: string,
  filters: SpendingFilters = {},
) {
  const [spending, incomeRows, contributionRows] = await Promise.all([
    getSpending({ householdId, ownerUserId: userId, month, filters }),
    db.query.incomes.findMany({
      where: and(eq(incomes.userId, userId), like(incomes.date, monthPattern(month))),
      orderBy: [desc(incomes.date), desc(incomes.createdAt)],
      with: { source: true },
    }),
    db.query.sharedContributions.findMany({
      where: and(eq(sharedContributions.userId, userId), like(sharedContributions.date, monthPattern(month))),
      orderBy: [desc(sharedContributions.date), desc(sharedContributions.createdAt)],
    }),
  ]);

  const flow = personalFlow({
    income: incomeRows.reduce((sum, i) => sum + i.amount, 0),
    spent: spending.totalSpent,
    saved: savedInMonth(userId, month),
    contributed: contributionRows.reduce((sum, c) => sum + c.amount, 0),
  });

  return {
    spending,
    flow,
    incomes: incomeRows.map((i) => ({
      id: i.id,
      amount: i.amount,
      date: i.date,
      note: i.note,
      sourceName: i.source?.name ?? null,
    })),
    contributions: contributionRows.map((c) => ({ id: c.id, amount: c.amount, date: c.date, note: c.note })),
  };
}

/** Just the totals, for the overview. */
export async function getPersonalTotals(householdId: string, userId: string, month: string) {
  const { flow, spending } = await getPersonalMonth(householdId, userId, month);
  return { ...flow, planned: spending.totalPlanned };
}

/** Everything paid into the shared pot this month, per person. */
export function getContributionsForMonth(householdId: string, month: string) {
  return db
    .select({ userId: sharedContributions.userId, amount: sharedContributions.amount })
    .from(sharedContributions)
    .where(
      and(
        eq(sharedContributions.householdId, householdId),
        like(sharedContributions.date, monthPattern(month)),
      ),
    )
    .all();
}
