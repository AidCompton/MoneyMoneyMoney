import "server-only";
import { and, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { goalContributions, savingsGoals } from "@/db/schema";
import { householdFlow } from "@/lib/calculations";
import { monthPattern } from "@/lib/dates";
import { getGoalsWithProgress, getHouseholdMembers } from "./core";
import { getContributionsForMonth, getPersonalTotals } from "./personal";
import { totalJointSavingsBalance, totalSavingsBalance } from "./savings";
import { getSpending } from "./spending";

/** Shared and personal money for the month, added up for the whole household. */
export async function getHouseholdOverview(householdId: string, month: string) {
  const members = await getHouseholdMembers(householdId);
  const [shared, goals, people, goalRows, contributionRows, jointSavings] = await Promise.all([
    getSpending({ householdId, ownerUserId: null, month }),
    getGoalsWithProgress(householdId),
    Promise.all(
      members.map(async (m) => ({
        id: m.id,
        name: m.name,
        ...(await getPersonalTotals(householdId, m.id, month)),
        savingsBalance: await totalSavingsBalance(m.id),
      })),
    ),
    db
      .select({ amount: goalContributions.amount })
      .from(goalContributions)
      .innerJoin(savingsGoals, eq(savingsGoals.id, goalContributions.goalId))
      .where(and(eq(savingsGoals.householdId, householdId), like(goalContributions.date, monthPattern(month)))),
    getContributionsForMonth(householdId, month),
    totalJointSavingsBalance(householdId),
  ]);

  const goalSavedThisMonth = goalRows.reduce((sum, c) => sum + c.amount, 0);
  const contributed = contributionRows.reduce((sum, c) => sum + c.amount, 0);

  const sum = (pick: (p: (typeof people)[number]) => number) => people.reduce((total, p) => total + pick(p), 0);
  const household = householdFlow({
    income: sum((p) => p.income),
    sharedSpent: shared.totalSpent,
    personalSpent: sum((p) => p.spent),
    saved: sum((p) => p.saved) + goalSavedThisMonth,
  });

  const goalsSaved = goals.reduce((total, g) => total + g.saved, 0);
  const personalSavings = sum((p) => p.savingsBalance);

  return {
    shared,
    goals,
    people,
    household,
    goalSavedThisMonth,
    contributed,
    goalsSaved,
    personalSavings,
    jointSavings,
    totalSaved: goalsSaved + personalSavings + jointSavings,
  };
}
