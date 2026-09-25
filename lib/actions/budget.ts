"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { monthlyBudgets, expenses } from "@/db/schema";
import { requireSession } from "@/lib/auth";

export type ActionState = { error?: string };

const CATEGORY = "Groceries";

export async function setBudget(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { household } = await requireSession();

  const month = String(formData.get("month") ?? "").trim();
  const budgetedAmount = Number(formData.get("budgetedAmount"));

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return { error: "Invalid month." };
  }
  if (!Number.isFinite(budgetedAmount) || budgetedAmount <= 0) {
    return { error: "Budget amount must be a positive number." };
  }

  await db
    .insert(monthlyBudgets)
    .values({ householdId: household.id, month, category: CATEGORY, budgetedAmount })
    .onConflictDoUpdate({
      target: [monthlyBudgets.householdId, monthlyBudgets.month, monthlyBudgets.category],
      set: { budgetedAmount },
    });

  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return {};
}

export async function logExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, household } = await requireSession();

  const budgetId = String(formData.get("budgetId") ?? "");
  const amount = Number(formData.get("amount"));
  const description = String(formData.get("description") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();

  const budget = await db.query.monthlyBudgets.findFirst({
    where: eq(monthlyBudgets.id, budgetId),
  });
  if (!budget || budget.householdId !== household.id) {
    return { error: "That budget could not be found." };
  }
  if (!description) {
    return { error: "Add a short description." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be a positive number." };
  }
  if (!date) {
    return { error: "Pick a date for this expense." };
  }

  await db.insert(expenses).values({ budgetId, userId: user.id, amount, description, date });

  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteExpense(expenseId: string) {
  const { household } = await requireSession();

  const expense = await db.query.expenses.findFirst({
    where: eq(expenses.id, expenseId),
    with: { budget: true },
  });
  if (!expense || expense.budget.householdId !== household.id) return;

  await db.delete(expenses).where(eq(expenses.id, expenseId));

  revalidatePath("/budget");
  revalidatePath("/dashboard");
}
