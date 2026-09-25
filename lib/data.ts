import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  savingsGoals,
  goalContributions,
  monthlyBudgets,
  expenses,
  moneyMeetings,
  actionItems,
  users,
} from "@/db/schema";
import { goalProgressPercent, budgetRemaining } from "@/lib/calculations";
import { monthISO } from "@/lib/dates";
import { CATEGORIES, isCategory, type CategoryName } from "@/lib/categories";

export async function getHouseholdMembers(householdId: string) {
  return db.query.users.findMany({
    where: eq(users.householdId, householdId),
    orderBy: (user, { asc }) => [asc(user.createdAt)],
  });
}

export async function getGoalsWithProgress(householdId: string) {
  const goals = await db.query.savingsGoals.findMany({
    where: and(eq(savingsGoals.householdId, householdId), eq(savingsGoals.archived, false)),
    orderBy: (goal, { asc }) => [asc(goal.createdAt)],
  });

  const totals = await db
    .select({
      goalId: goalContributions.goalId,
      total: sql<number>`coalesce(sum(${goalContributions.amount}), 0)`,
    })
    .from(goalContributions)
    .groupBy(goalContributions.goalId);

  const totalsByGoal = new Map(totals.map((t) => [t.goalId, t.total]));

  return goals.map((goal) => {
    const saved = totalsByGoal.get(goal.id) ?? 0;
    return {
      ...goal,
      saved,
      percent: goalProgressPercent(saved, goal.targetAmount),
    };
  });
}

export async function getGoalWithContributions(goalId: string) {
  const goal = await db.query.savingsGoals.findFirst({ where: eq(savingsGoals.id, goalId) });
  if (!goal) return null;

  const contributions = await db.query.goalContributions.findMany({
    where: eq(goalContributions.goalId, goalId),
    orderBy: [desc(goalContributions.date), desc(goalContributions.createdAt)],
    with: { user: true },
  });

  const saved = contributions.reduce((sum, c) => sum + c.amount, 0);

  return {
    goal,
    contributions,
    saved,
    percent: goalProgressPercent(saved, goal.targetAmount),
  };
}

export function currentMonth() {
  return monthISO(); // YYYY-MM, local time
}

/**
 * Everything about one month's spending: each category's planned amount and
 * what has been spent against it, plus the expenses themselves.
 */
export async function getMonthSpending(householdId: string, month: string) {
  const budgetRows = await db.query.monthlyBudgets.findMany({
    where: and(eq(monthlyBudgets.householdId, householdId), eq(monthlyBudgets.month, month)),
  });

  const budgetIds = budgetRows.map((b) => b.id);
  const expenseList = budgetIds.length
    ? await db.query.expenses.findMany({
        where: inArray(expenses.budgetId, budgetIds),
        orderBy: [desc(expenses.date), desc(expenses.createdAt)],
        with: { user: true, budget: true },
      })
    : [];

  // Anything filed under a category that no longer exists counts as
  // Miscellaneous rather than disappearing from the totals.
  const bucket = (category: string): CategoryName => (isCategory(category) ? category : "Miscellaneous");

  const categories = CATEGORIES.map(({ name, color }) => {
    const planned = budgetRows
      .filter((b) => bucket(b.category) === name)
      .reduce((sum, b) => sum + b.budgetedAmount, 0);
    const spent = expenseList
      .filter((e) => bucket(e.budget.category) === name)
      .reduce((sum, e) => sum + e.amount, 0);
    return { name, color, planned, spent };
  });

  const totalPlanned = categories.reduce((sum, c) => sum + c.planned, 0);
  const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);

  return {
    categories,
    expenseList: expenseList.map((e) => ({ ...e, category: bucket(e.budget.category) })),
    totalPlanned,
    totalSpent,
    remaining: budgetRemaining(totalPlanned, totalSpent),
  };
}

export async function getMeetings(householdId: string) {
  return db.query.moneyMeetings.findMany({
    where: eq(moneyMeetings.householdId, householdId),
    orderBy: [desc(moneyMeetings.date)],
  });
}

export async function getMeetingWithItems(meetingId: string) {
  const meeting = await db.query.moneyMeetings.findFirst({
    where: eq(moneyMeetings.id, meetingId),
  });
  if (!meeting) return null;

  const items = await db.query.actionItems.findMany({
    where: eq(actionItems.meetingId, meetingId),
    orderBy: (item, { asc }) => [asc(item.done), asc(item.createdAt)],
    with: { assignee: true },
  });

  return { meeting, items };
}

export async function getCarryOverItems(householdId: string, excludeMeetingId?: string) {
  const rows = await db
    .select({
      id: actionItems.id,
      description: actionItems.description,
      dueDate: actionItems.dueDate,
      meetingId: actionItems.meetingId,
      meetingDate: moneyMeetings.date,
    })
    .from(actionItems)
    .innerJoin(moneyMeetings, eq(actionItems.meetingId, moneyMeetings.id))
    .where(and(eq(moneyMeetings.householdId, householdId), eq(actionItems.done, false)))
    .orderBy(desc(moneyMeetings.date));

  return excludeMeetingId ? rows.filter((r) => r.meetingId !== excludeMeetingId) : rows;
}
