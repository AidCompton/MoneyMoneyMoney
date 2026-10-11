import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  actionItems,
  budgetLines,
  categories,
  expenses,
  goalContributions,
  groceryItems,
  groceryListItems,
  households,
  incomes,
  labels,
  mealPreps,
  moneyMeetings,
  receiptAliases,
  receiptImages,
  receiptItems,
  receipts,
  savingsAccounts,
  savingsGoals,
  savingsTransactions,
  sharedContributions,
  subcategories,
  users,
} from "@/db/schema";

export const EXPORT_VERSION = 1;

/**
 * Everything your household has stored, as plain JSON: a backup you can keep
 * anywhere, and a way to move your data elsewhere. Password hashes and the
 * join code are left out. Receipt photos are included (as base64) when asked.
 */
export async function buildExport(householdId: string, { images = false } = {}) {
  const [household] = await db
    .select({ id: households.id, name: households.name, createdAt: households.createdAt })
    .from(households)
    .where(eq(households.id, householdId));

  const [
    members,
    categoryRows,
    subcategoryRows,
    labelRows,
    budgetLineRows,
    expenseRows,
    incomeRows,
    contributionRows,
    goalRows,
    accountRows,
    groceryItemRows,
    mealPrepRows,
    groceryLineRows,
    receiptRows,
    aliasRows,
    meetingRows,
  ] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.householdId, householdId)),
    db.select().from(categories).where(eq(categories.householdId, householdId)),
    db.select().from(subcategories).where(eq(subcategories.householdId, householdId)),
    db.select().from(labels).where(eq(labels.householdId, householdId)),
    db.select().from(budgetLines).where(eq(budgetLines.householdId, householdId)),
    db.select().from(expenses).where(eq(expenses.householdId, householdId)),
    db.select().from(incomes).where(eq(incomes.householdId, householdId)),
    db.select().from(sharedContributions).where(eq(sharedContributions.householdId, householdId)),
    db.select().from(savingsGoals).where(eq(savingsGoals.householdId, householdId)),
    db.select().from(savingsAccounts).where(eq(savingsAccounts.householdId, householdId)),
    db.select().from(groceryItems).where(eq(groceryItems.householdId, householdId)),
    db.select().from(mealPreps).where(eq(mealPreps.householdId, householdId)),
    db.select().from(groceryListItems).where(eq(groceryListItems.householdId, householdId)),
    db.select().from(receipts).where(eq(receipts.householdId, householdId)),
    db.select().from(receiptAliases).where(eq(receiptAliases.householdId, householdId)),
    db.select().from(moneyMeetings).where(eq(moneyMeetings.householdId, householdId)),
  ]);

  const goalIds = goalRows.map((g) => g.id);
  const accountIds = accountRows.map((a) => a.id);
  const receiptIds = receiptRows.map((r) => r.id);
  const meetingIds = meetingRows.map((m) => m.id);
  const [goalContributionRows, transactionRows, receiptItemRows, actionItemRows, imageRows] = await Promise.all([
    goalIds.length ? db.select().from(goalContributions).where(inArray(goalContributions.goalId, goalIds)) : [],
    accountIds.length
      ? db.select().from(savingsTransactions).where(inArray(savingsTransactions.accountId, accountIds))
      : [],
    receiptIds.length ? db.select().from(receiptItems).where(inArray(receiptItems.receiptId, receiptIds)) : [],
    meetingIds.length ? db.select().from(actionItems).where(inArray(actionItems.meetingId, meetingIds)) : [],
    images && receiptIds.length
      ? db.select().from(receiptImages).where(inArray(receiptImages.receiptId, receiptIds))
      : [],
  ]);

  return {
    app: "MoneyMoneyMoney",
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    household,
    members,
    categories: categoryRows,
    subcategories: subcategoryRows,
    labels: labelRows,
    budgetLines: budgetLineRows,
    expenses: expenseRows,
    incomes: incomeRows,
    sharedContributions: contributionRows,
    savingsGoals: goalRows,
    goalContributions: goalContributionRows,
    savingsAccounts: accountRows,
    savingsTransactions: transactionRows,
    groceryItems: groceryItemRows,
    mealPreps: mealPrepRows,
    groceryListItems: groceryLineRows,
    receipts: receiptRows,
    receiptItems: receiptItemRows,
    receiptAliases: aliasRows,
    moneyMeetings: meetingRows,
    actionItems: actionItemRows,
    receiptImages: imageRows.map((i) => ({
      receiptId: i.receiptId,
      contentType: i.contentType,
      data: Buffer.from(i.data).toString("base64"),
    })),
  };
}
