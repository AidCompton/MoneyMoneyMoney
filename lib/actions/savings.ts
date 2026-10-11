"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { savingsAccounts, savingsTransactions } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { isISODate, isId, money, optionalStr, str } from "@/lib/form";
import { findOrCreateLabel } from "@/lib/data/lists";

export type ActionState = { error?: string; saved?: boolean };

function readAccount(fd: FormData) {
  const name = str(fd, "name");
  const target = money(fd, "targetAmount");
  if (!name) return { error: "Give the account a name." };
  if (target !== null && (Number.isNaN(target) || target <= 0)) {
    return { error: "The target must be a positive number, or left blank." };
  }
  return { name, institution: optionalStr(fd, "institution"), targetAmount: target };
}

export async function createSavingsAccount(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, household } = await requireSession();
  const fields = readAccount(fd);
  if ("error" in fields) return { error: fields.error };
  const opening = money(fd, "openingBalance") ?? 0;
  if (Number.isNaN(opening) || opening < 0) return { error: "The current balance must be zero or more." };
  const openingDate = str(fd, "openingDate") || todayISO();
  if (!isISODate(openingDate)) return { error: "Pick the date of that balance." };
  const joint = str(fd, "scope") === "joint";

  const [account] = await db
    .insert(savingsAccounts)
    .values({
      householdId: household.id,
      ownerUserId: joint ? null : user.id,
      ...fields,
      openingBalance: opening,
      openingDate,
    })
    .returning();

  revalidatePath("/", "layout");
  redirect(`/personal/${user.id}/savings/${account.id}`);
}

/** A personal account you own, or a joint account shared by your household. */
async function ownAccount(accountId: string) {
  const { user, household } = await requireSession();
  if (!isId(accountId)) return null;
  const [account] = await db.select().from(savingsAccounts).where(eq(savingsAccounts.id, accountId)).limit(1);
  if (!account || account.householdId !== household.id) return null;
  const allowed = account.ownerUserId ? account.ownerUserId === user.id : true;
  return allowed ? { account, user } : null;
}

export async function updateSavingsAccount(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const owned = await ownAccount(str(fd, "accountId"));
  if (!owned) return { error: "That account could not be found." };
  const fields = readAccount(fd);
  if ("error" in fields) return { error: fields.error };

  await db.update(savingsAccounts).set(fields).where(eq(savingsAccounts.id, owned.account.id));
  revalidatePath("/", "layout");
  return { saved: true };
}

export async function deleteSavingsAccount(accountId: string) {
  const owned = await ownAccount(accountId);
  if (!owned) return;
  // Its deposits and withdrawals go with it (ON DELETE CASCADE).
  await db.delete(savingsAccounts).where(eq(savingsAccounts.id, owned.account.id));
  revalidatePath("/", "layout");
  redirect(`/personal/${owned.user.id}/savings`);
}

/** A deposit or withdrawal. Withdrawals are stored as negative amounts. */
export async function addSavingsTransaction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const owned = await ownAccount(str(fd, "accountId"));
  if (!owned) return { error: "Pick one of your accounts." };
  const amount = money(fd, "amount");
  const date = str(fd, "date");
  if (amount === null || Number.isNaN(amount) || amount <= 0) return { error: "Amount must be a positive number." };
  if (!isISODate(date)) return { error: "Pick a date." };
  const withdrawal = str(fd, "direction") === "out";

  await db.transaction(async (tx) => {
    const tag = await findOrCreateLabel(owned.account.householdId, "savings_tag", str(fd, "tag"), tx);
    await tx.insert(savingsTransactions).values({
      accountId: owned.account.id,
      userId: owned.user.id,
      tagId: tag?.id ?? null,
      amount: withdrawal ? -amount : amount,
      date,
      note: optionalStr(fd, "note"),
    });
  });

  revalidatePath("/", "layout");
  return { saved: true };
}

/** Removes a deposit or withdrawal from your own account or a joint one. */
export async function deleteSavingsTransaction(transactionId: string) {
  const { user, household } = await requireSession();
  if (!isId(transactionId)) return;
  const [row] = await db
    .select({ id: savingsTransactions.id, owner: savingsAccounts.ownerUserId, householdId: savingsAccounts.householdId })
    .from(savingsTransactions)
    .innerJoin(savingsAccounts, eq(savingsAccounts.id, savingsTransactions.accountId))
    .where(eq(savingsTransactions.id, transactionId))
    .limit(1);
  if (!row || row.householdId !== household.id) return;
  if (row.owner && row.owner !== user.id) return;
  await db.delete(savingsTransactions).where(eq(savingsTransactions.id, transactionId));
  revalidatePath("/", "layout");
}
