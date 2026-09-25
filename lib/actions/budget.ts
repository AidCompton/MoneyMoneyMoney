"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { monthlyBudgets, expenses } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { CATEGORIES, isCategory, planField } from "@/lib/categories";

export type ActionState = { error?: string; saved?: boolean };

const MONTH = /^\d{4}-\d{2}$/;

function revalidateSpending() {
  revalidatePath("/budget");
  revalidatePath("/dashboard");
  revalidatePath("/meetings", "layout");
}

/** Saves the planned amount for every category in a month at once. */
export async function setBudgetPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { household } = await requireSession();

  const month = String(formData.get("month") ?? "").trim();
  if (!MONTH.test(month)) {
    return { error: "Invalid month." };
  }

  const plan: { category: string; amount: number }[] = [];
  for (const { name } of CATEGORIES) {
    const raw = String(formData.get(planField(name)) ?? "").trim();
    const amount = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      return { error: `The amount for ${name} must be zero or more.` };
    }
    plan.push({ category: name, amount });
  }

  db.transaction((tx) => {
    for (const { category, amount } of plan) {
      tx.insert(monthlyBudgets)
        .values({ householdId: household.id, month, category, budgetedAmount: amount })
        .onConflictDoUpdate({
          target: [monthlyBudgets.householdId, monthlyBudgets.month, monthlyBudgets.category],
          set: { budgetedAmount: amount },
        })
        .run();
    }
  });

  revalidateSpending();
  return { saved: true };
}

export async function logExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, household } = await requireSession();

  const month = String(formData.get("month") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const amount = Number(formData.get("amount"));
  const date = String(formData.get("date") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || category;

  if (!MONTH.test(month)) {
    return { error: "Invalid month." };
  }
  if (!isCategory(category)) {
    return { error: "Pick a category." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be a positive number." };
  }
  if (!date.startsWith(`${month}-`)) {
    return { error: "Pick a date in the month you're viewing." };
  }

  // A category needs a budget row to hang expenses off. Spending in a
  // category with nothing planned creates one with a zero plan.
  await db
    .insert(monthlyBudgets)
    .values({ householdId: household.id, month, category, budgetedAmount: 0 })
    .onConflictDoNothing();
  const budget = await db.query.monthlyBudgets.findFirst({
    where: and(
      eq(monthlyBudgets.householdId, household.id),
      eq(monthlyBudgets.month, month),
      eq(monthlyBudgets.category, category),
    ),
  });
  if (!budget) {
    return { error: "Could not file that expense. Please try again." };
  }

  await db.insert(expenses).values({ budgetId: budget.id, userId: user.id, amount, description, date });

  revalidateSpending();
  return { saved: true };
}

export async function deleteExpense(expenseId: string) {
  const { household } = await requireSession();

  const expense = await db.query.expenses.findFirst({
    where: eq(expenses.id, expenseId),
    with: { budget: true },
  });
  if (!expense || expense.budget.householdId !== household.id) return;

  await db.delete(expenses).where(eq(expenses.id, expenseId));

  revalidateSpending();
}
