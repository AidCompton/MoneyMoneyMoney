"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { savingsGoals, goalContributions } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { isISODate, isId, money, optionalStr, str } from "@/lib/form";

export type ActionState = { error?: string; saved?: boolean };

function readGoal(fd: FormData) {
  const name = str(fd, "name");
  const targetAmount = money(fd, "targetAmount");
  const targetDate = str(fd, "targetDate") || null;
  if (!name) return { error: "Give the goal a name." };
  if (targetAmount === null || Number.isNaN(targetAmount) || targetAmount <= 0) {
    return { error: "Target amount must be a positive number." };
  }
  if (targetDate && !isISODate(targetDate)) return { error: "Pick a valid target date." };
  return { name, targetAmount, targetDate };
}

async function ownedGoal(goalId: string, householdId: string) {
  if (!isId(goalId)) return null;
  const goal = await db.query.savingsGoals.findFirst({
    where: and(eq(savingsGoals.id, goalId), eq(savingsGoals.householdId, householdId)),
  });
  return goal ?? null;
}

export async function createGoal(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { household } = await requireSession();
  const fields = readGoal(fd);
  if ("error" in fields) return { error: fields.error };

  const [goal] = await db
    .insert(savingsGoals)
    .values({ householdId: household.id, ...fields })
    .returning();

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  redirect(`/goals/${goal.id}`);
}

export async function addContribution(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, household } = await requireSession();

  const goal = await ownedGoal(str(fd, "goalId"), household.id);
  if (!goal) return { error: "That goal could not be found." };
  const amount = money(fd, "amount");
  const date = str(fd, "date");
  if (amount === null || Number.isNaN(amount) || amount <= 0) {
    return { error: "Contribution amount must be a positive number." };
  }
  if (!isISODate(date)) return { error: "Pick a date for this contribution." };

  await db.insert(goalContributions).values({ goalId: goal.id, userId: user.id, amount, date, note: optionalStr(fd, "note") });

  revalidatePath(`/goals/${goal.id}`);
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return {};
}

export async function updateGoal(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { household } = await requireSession();

  const goal = await ownedGoal(str(fd, "goalId"), household.id);
  if (!goal) return { error: "That goal could not be found." };
  const fields = readGoal(fd);
  if ("error" in fields) return { error: fields.error };

  await db.update(savingsGoals).set(fields).where(eq(savingsGoals.id, goal.id));

  revalidatePath(`/goals/${goal.id}`);
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return { saved: true };
}

export async function deleteGoal(goalId: string) {
  const { household } = await requireSession();
  const goal = await ownedGoal(goalId, household.id);
  if (!goal) return;

  // Contributions go with it (ON DELETE CASCADE).
  await db.delete(savingsGoals).where(eq(savingsGoals.id, goal.id));

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  redirect("/goals");
}

export async function deleteContribution(contributionId: string) {
  const { household } = await requireSession();
  if (!isId(contributionId)) return;

  const contribution = await db.query.goalContributions.findFirst({
    where: eq(goalContributions.id, contributionId),
  });
  if (!contribution || !(await ownedGoal(contribution.goalId, household.id))) return;

  await db.delete(goalContributions).where(eq(goalContributions.id, contributionId));

  revalidatePath(`/goals/${contribution.goalId}`);
  revalidatePath("/goals");
  revalidatePath("/dashboard");
}
