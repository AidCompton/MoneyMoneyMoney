"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { incomes, sharedContributions } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { isISODate, money, optionalStr, str } from "@/lib/form";
import { findOrCreateLabel } from "@/lib/data/lists";

export type ActionState = { error?: string; saved?: boolean };

function checkAmountAndDate(amount: number | null, date: string) {
  if (amount === null || Number.isNaN(amount) || amount <= 0) return "Amount must be a positive number.";
  if (!isISODate(date)) return "Pick a date.";
  return null;
}

export async function addIncome(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, household } = await requireSession();
  const amount = money(fd, "amount");
  const date = str(fd, "date");
  const invalid = checkAmountAndDate(amount, date);
  if (invalid) return { error: invalid };

  db.transaction((tx) => {
    const source = findOrCreateLabel(household.id, "income_source", str(fd, "source"), tx);
    tx.insert(incomes)
      .values({
        householdId: household.id,
        userId: user.id,
        sourceId: source?.id ?? null,
        amount: amount!,
        date,
        note: optionalStr(fd, "note"),
      })
      .run();
  });

  revalidatePath("/", "layout");
  return { saved: true };
}

export async function deleteIncome(incomeId: string) {
  const { user } = await requireSession();
  const income = db.select().from(incomes).where(eq(incomes.id, incomeId)).get();
  if (!income || income.userId !== user.id) return;
  db.delete(incomes).where(eq(incomes.id, incomeId)).run();
  revalidatePath("/", "layout");
}

/** Records money moved from your own funds into the shared pot. */
export async function addSharedContribution(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { user, household } = await requireSession();
  const amount = money(fd, "amount");
  const date = str(fd, "date");
  const invalid = checkAmountAndDate(amount, date);
  if (invalid) return { error: invalid };

  db.insert(sharedContributions)
    .values({ householdId: household.id, userId: user.id, amount: amount!, date, note: optionalStr(fd, "note") })
    .run();

  revalidatePath("/", "layout");
  return { saved: true };
}

export async function deleteSharedContribution(contributionId: string) {
  const { user } = await requireSession();
  const row = db.select().from(sharedContributions).where(eq(sharedContributions.id, contributionId)).get();
  if (!row || row.userId !== user.id) return;
  db.delete(sharedContributions).where(eq(sharedContributions.id, contributionId)).run();
  revalidatePath("/", "layout");
}
