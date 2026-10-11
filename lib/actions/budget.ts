"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { budgetLines, categories, expenses } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { isMonth } from "@/lib/dates";
import { MAX_AMOUNT, cents, isISODate, isId, money, str } from "@/lib/form";
import {
  ensureSharedCategories,
  findOrCreateLabel,
  findOrCreatePersonalCategory,
  findOrCreateSubcategory,
} from "@/lib/data/lists";

export type ActionState = { error?: string; saved?: boolean };

/**
 * Saves a month's plan. Shared plans cover the eight shared categories;
 * personal plans cover your own categories, plus optionally one new one typed
 * into the "add a category" field. A blank or zero amount removes the line.
 */
export async function saveBudgetPlan(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, household } = await requireSession();
  const personal = str(fd, "scope") === "personal";
  const owner = personal ? user.id : null;
  const month = str(fd, "month");
  if (!isMonth(month)) return { error: "Invalid month." };

  const plan = new Map<string, number>();
  for (const [field, value] of fd.entries()) {
    if (!field.startsWith("plan-")) continue;
    const categoryId = field.slice(5);
    if (!isId(categoryId)) return { error: "Some of those categories couldn't be found." };
    const raw = String(value).trim();
    const amount = raw === "" ? 0 : Number(raw.replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) return { error: "Amounts must be zero or more." };
    plan.set(categoryId, cents(amount));
  }
  if (plan.size > 200) return { error: "Too many categories." };

  const newName = str(fd, "newCategory");
  const newAmount = money(fd, "newAmount");
  if (newName && (newAmount === null || Number.isNaN(newAmount) || newAmount <= 0)) {
    return { error: `Give ${newName} a planned amount.` };
  }

  if (!personal) await ensureSharedCategories(household.id);

  const error = await db.transaction(async (tx) => {
    // Only this household's categories of the right kind can be planned.
    const ids = [...plan.keys()];
    const valid = ids.length
      ? await tx
          .select({ id: categories.id })
          .from(categories)
          .where(
            and(
              inArray(categories.id, ids),
              eq(categories.householdId, household.id),
              eq(categories.scope, personal ? "personal" : "shared"),
            ),
          )
      : [];
    if (valid.length !== ids.length) return "Some of those categories couldn't be found.";

    if (personal && newName) {
      const category = await findOrCreatePersonalCategory(household.id, newName, tx);
      if (category) plan.set(category.id, cents((plan.get(category.id) ?? 0) + (newAmount ?? 0)));
    }

    for (const [categoryId, amount] of plan) {
      if (amount > 0) {
        await tx
          .insert(budgetLines)
          .values({ householdId: household.id, ownerUserId: owner, month, categoryId, amount })
          .onConflictDoUpdate({
            target: [budgetLines.householdId, budgetLines.ownerUserId, budgetLines.month, budgetLines.categoryId],
            set: { amount },
          });
      } else {
        await tx
          .delete(budgetLines)
          .where(
            and(
              eq(budgetLines.householdId, household.id),
              owner ? eq(budgetLines.ownerUserId, owner) : isNull(budgetLines.ownerUserId),
              eq(budgetLines.month, month),
              eq(budgetLines.categoryId, categoryId),
            ),
          );
      }
    }
    return null;
  });
  if (error) return { error };

  revalidatePath("/", "layout");
  return { saved: true };
}

/**
 * Adds a shared or personal expense. Sub-categories and stores are typed or
 * picked from the dropdown; anything new is added to its list.
 */
export async function addExpense(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, household } = await requireSession();
  const personal = str(fd, "scope") === "personal";
  const month = str(fd, "month");
  const amount = money(fd, "amount");
  const date = str(fd, "date");
  const categoryField = str(fd, "category");
  const subcategoryName = str(fd, "subcategory");
  const storeName = str(fd, "store");
  const description = str(fd, "description");

  if (!isMonth(month)) return { error: "Invalid month." };
  if (!categoryField) return { error: "Pick a category." };
  if (amount === null || Number.isNaN(amount) || amount <= 0) {
    return { error: "Amount must be a positive number." };
  }
  if (!isISODate(date) || !date.startsWith(`${month}-`)) {
    return { error: "Pick a date in the month you're viewing." };
  }

  const error = await db.transaction(async (tx) => {
    let category;
    if (personal) {
      category = await findOrCreatePersonalCategory(household.id, categoryField, tx);
    } else if (isId(categoryField)) {
      [category] = await tx
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.id, categoryField),
            eq(categories.householdId, household.id),
            eq(categories.scope, "shared"),
          ),
        )
        .limit(1);
    }
    if (!category) return "Pick a category.";

    const subcategory = subcategoryName
      ? await findOrCreateSubcategory(household.id, category.id, subcategoryName, tx)
      : null;
    const store = storeName ? await findOrCreateLabel(household.id, "store", storeName, tx) : null;

    await tx.insert(expenses).values({
      householdId: household.id,
      ownerUserId: personal ? user.id : null,
      categoryId: category.id,
      subcategoryId: subcategory?.id ?? null,
      storeId: store?.id ?? null,
      userId: user.id,
      amount,
      date,
      description: description || subcategory?.name || store?.name || category.name,
    });
    return null;
  });
  if (error) return { error };

  revalidatePath("/", "layout");
  return { saved: true };
}

export async function deleteExpense(expenseId: string) {
  const { user, household } = await requireSession();
  if (!isId(expenseId)) return;
  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
  if (!expense || expense.householdId !== household.id) return;
  // Personal expenses can only be removed by their owner.
  if (expense.ownerUserId && expense.ownerUserId !== user.id) return;

  await db.delete(expenses).where(eq(expenses.id, expenseId));
  revalidatePath("/", "layout");
}
