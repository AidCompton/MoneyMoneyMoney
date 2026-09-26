"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { savingsGoals, goalContributions } from "@/db/schema";
import { requireSession } from "@/lib/auth";

export type ActionState = { error?: string; saved?: boolean };

export async function createGoal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { household } = await requireSession();

  const name = String(formData.get("name") ?? "").trim();
  const targetAmount = Number(formData.get("targetAmount"));
  const targetDate = String(formData.get("targetDate") ?? "").trim() || null;

  if (!name) {
    return { error: "Give the goal a name." };
  }
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return { error: "Target amount must be a positive number." };
  }

  const [goal] = await db
    .insert(savingsGoals)
    .values({ householdId: household.id, name, targetAmount, targetDate })
    .returning();

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  redirect(`/goals/${goal.id}`);
}

export async function addContribution(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, household } = await requireSession();

  const goalId = String(formData.get("goalId") ?? "");
  const amount = Number(formData.get("amount"));
  const date = String(formData.get("date") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;

  const goal = await db.query.savingsGoals.findFirst({ where: eq(savingsGoals.id, goalId) });
  if (!goal || goal.householdId !== household.id) {
    return { error: "That goal could not be found." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Contribution amount must be a positive number." };
  }
  if (!date) {
    return { error: "Pick a date for this contribution." };
  }

  await db.insert(goalContributions).values({ goalId, userId: user.id, amount, date, note });

  revalidatePath(`/goals/${goalId}`);
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return {};
}

async function ownedGoal(goalId: string, householdId: string) {
  const goal = await db.query.savingsGoals.findFirst({ where: eq(savingsGoals.id, goalId) });
  return goal && goal.householdId === householdId ? goal : null;
}

export async function updateGoal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { household } = await requireSession();

  const goalId = String(formData.get("goalId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const targetAmount = Number(formData.get("targetAmount"));
  const targetDate = String(formData.get("targetDate") ?? "").trim() || null;

  if (!(await ownedGoal(goalId, household.id))) {
    return { error: "That goal could not be found." };
  }
  if (!name) {
    return { error: "Give the goal a name." };
  }
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return { error: "Target amount must be a positive number." };
  }

  await db
    .update(savingsGoals)
    .set({ name, targetAmount, targetDate })
    .where(eq(savingsGoals.id, goalId));

  revalidatePath(`/goals/${goalId}`);
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return { saved: true };
}

export async function deleteGoal(goalId: string) {
  const { household } = await requireSession();
  if (!(await ownedGoal(goalId, household.id))) return;

  // Contributions go with it (ON DELETE CASCADE).
  await db.delete(savingsGoals).where(eq(savingsGoals.id, goalId));

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  redirect("/goals");
}

export async function deleteContribution(contributionId: string) {
  const { household } = await requireSession();

  const contribution = await db.query.goalContributions.findFirst({
    where: eq(goalContributions.id, contributionId),
  });
  if (!contribution || !(await ownedGoal(contribution.goalId, household.id))) return;

  await db.delete(goalContributions).where(eq(goalContributions.id, contributionId));

  revalidatePath(`/goals/${contribution.goalId}`);
  revalidatePath("/goals");
  revalidatePath("/dashboard");
}
