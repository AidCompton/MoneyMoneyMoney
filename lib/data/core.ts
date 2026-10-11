import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { savingsGoals, goalContributions, moneyMeetings, actionItems, users } from "@/db/schema";
import { goalProgressPercent } from "@/lib/calculations";
import { monthISO } from "@/lib/dates";

export async function getHouseholdMembers(householdId: string) {
  return db.query.users.findMany({
    where: eq(users.householdId, householdId),
    orderBy: (user, { asc }) => [asc(user.createdAt)],
    columns: { passwordHash: false },
  });
}

export async function getGoalsWithProgress(householdId: string) {
  const [goals, totals] = await Promise.all([
    db.query.savingsGoals.findMany({
      where: and(eq(savingsGoals.householdId, householdId), eq(savingsGoals.archived, false)),
      orderBy: (goal, { asc }) => [asc(goal.createdAt)],
    }),
    db
      .select({
        goalId: goalContributions.goalId,
        total: sql<number>`coalesce(sum(${goalContributions.amount}), 0)`.mapWith(Number),
      })
      .from(goalContributions)
      .innerJoin(savingsGoals, eq(savingsGoals.id, goalContributions.goalId))
      .where(eq(savingsGoals.householdId, householdId))
      .groupBy(goalContributions.goalId),
  ]);

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

/** A goal and its contributions, or null if it isn't this household's. */
export async function getGoalWithContributions(goalId: string, householdId: string) {
  const goal = await db.query.savingsGoals.findFirst({
    where: and(eq(savingsGoals.id, goalId), eq(savingsGoals.householdId, householdId)),
  });
  if (!goal) return null;

  const contributions = await db.query.goalContributions.findMany({
    where: eq(goalContributions.goalId, goalId),
    orderBy: [desc(goalContributions.date), desc(goalContributions.createdAt)],
    with: { user: { columns: { id: true, name: true } } },
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

export async function getMeetings(householdId: string) {
  return db.query.moneyMeetings.findMany({
    where: eq(moneyMeetings.householdId, householdId),
    orderBy: [desc(moneyMeetings.date)],
  });
}

/** A meeting and its action items, or null if it isn't this household's. */
export async function getMeetingWithItems(meetingId: string, householdId: string) {
  const meeting = await db.query.moneyMeetings.findFirst({
    where: and(eq(moneyMeetings.id, meetingId), eq(moneyMeetings.householdId, householdId)),
  });
  if (!meeting) return null;

  const items = await db.query.actionItems.findMany({
    where: eq(actionItems.meetingId, meetingId),
    orderBy: [asc(actionItems.done), asc(actionItems.createdAt)],
    with: { assignee: { columns: { id: true, name: true } } },
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
