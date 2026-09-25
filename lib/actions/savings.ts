"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { savingsAccounts, savingsTransactions } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { isISODate, money, optionalStr, str } from "@/lib/form";
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

  const account = db
    .insert(savingsAccounts)
    .values({
      householdId: household.id,
      ownerUserId: user.id,
      ...fields,
      openingBalance: opening,
      openingDate,
    })
    .returning()
    .get();

  revalidatePath("/", "layout");
  redirect(`/personal/${user.id}/savings/${account.id}`);
}

async function ownAccount(accountId: string) {
  const { user } = await requireSession();
  const account = db.select().from(savingsAccounts).where(eq(savingsAccounts.id, accountId)).get();
  return account && account.ownerUserId === user.id ? { account, user } : null;
}

export async function updateSavingsAccount(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const owned = await ownAccount(str(fd, "accountId"));
  if (!owned) return { error: "That account could not be found." };
  const fields = readAccount(fd);
  if ("error" in fields) return { error: fields.error };

  db.update(savingsAccounts).set(fields).where(eq(savingsAccounts.id, owned.account.id)).run();
  revalidatePath("/", "layout");
  return { saved: true };
}

export async function deleteSavingsAccount(accountId: string) {
  const owned = await ownAccount(accountId);
  if (!owned) return;
  // Its deposits and withdrawals go with it (ON DELETE CASCADE).
  db.delete(savingsAccounts).where(eq(savingsAccounts.id, accountId)).run();
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

  db.transaction((tx) => {
    const tag = findOrCreateLabel(owned.account.householdId, "savings_tag", str(fd, "tag"), tx);
    tx.insert(savingsTransactions)
      .values({
        accountId: owned.account.id,
        userId: owned.user.id,
        tagId: tag?.id ?? null,
        amount: withdrawal ? -amount : amount,
        date,
        note: optionalStr(fd, "note"),
      })
      .run();
  });

  revalidatePath("/", "layout");
  return { saved: true };
}

export async function deleteSavingsTransaction(transactionId: string) {
  const { user } = await requireSession();
  const row = db
    .select({ id: savingsTransactions.id, owner: savingsAccounts.ownerUserId })
    .from(savingsTransactions)
    .innerJoin(savingsAccounts, eq(savingsAccounts.id, savingsTransactions.accountId))
    .where(eq(savingsTransactions.id, transactionId))
    .get();
  if (!row || row.owner !== user.id) return;
  db.delete(savingsTransactions).where(eq(savingsTransactions.id, transactionId)).run();
  revalidatePath("/", "layout");
}
