import "server-only";
import { and, asc, desc, eq, inArray, isNull, like, or } from "drizzle-orm";
import { db } from "@/db";
import { savingsAccounts, savingsTransactions } from "@/db/schema";
import { goalProgressPercent } from "@/lib/calculations";
import { monthPattern } from "@/lib/dates";
import { crossFilter, type Dimension } from "@/lib/facets";

export type SavingsFilters = { account?: string; tag?: string; dir?: string };

type Account = typeof savingsAccounts.$inferSelect;
type Tx = typeof savingsTransactions.$inferSelect;

/**
 * Running balance over time. The opening balance is always its own first
 * point, so an account opened and topped up on the same day still draws a
 * line from where it started.
 */
function balanceSeries(account: Account, txs: Tx[]) {
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date) || +a.createdAt - +b.createdAt);
  const points: { date: string; balance: number; opening?: boolean }[] = [
    { date: account.openingDate, balance: account.openingBalance, opening: true },
  ];
  let balance = account.openingBalance;
  for (const tx of sorted) {
    balance += tx.amount;
    const last = points[points.length - 1];
    if (!last.opening && last.date === tx.date) last.balance = balance;
    else points.push({ date: tx.date, balance });
  }
  return points;
}

function summarise(account: Account, txs: Tx[], month: string) {
  const balance = txs.reduce((sum, t) => sum + t.amount, account.openingBalance);
  const thisMonth = txs.filter((t) => t.date.startsWith(`${month}-`)).reduce((sum, t) => sum + t.amount, 0);
  return {
    id: account.id,
    name: account.name,
    institution: account.institution,
    targetAmount: account.targetAmount,
    openingBalance: account.openingBalance,
    openingDate: account.openingDate,
    ownerUserId: account.ownerUserId,
    joint: account.ownerUserId === null,
    balance,
    thisMonth,
    percent: account.targetAmount ? goalProgressPercent(balance, account.targetAmount) : null,
    series: balanceSeries(account, txs),
  };
}

/** A person's own accounts, plus their household's joint accounts. */
export async function getSavingsAccounts(householdId: string, ownerUserId: string, month: string) {
  const accounts = await db
    .select()
    .from(savingsAccounts)
    .where(
      and(
        eq(savingsAccounts.householdId, householdId),
        or(eq(savingsAccounts.ownerUserId, ownerUserId), isNull(savingsAccounts.ownerUserId)),
        eq(savingsAccounts.archived, false),
      ),
    )
    .orderBy(asc(savingsAccounts.createdAt));
  const ids = accounts.map((a) => a.id);
  const txs = ids.length ? await db.select().from(savingsTransactions).where(inArray(savingsTransactions.accountId, ids)) : [];
  return accounts.map((a) =>
    summarise(
      a,
      txs.filter((t) => t.accountId === a.id),
      month,
    ),
  );
}

export type SavingsAccountSummary = Awaited<ReturnType<typeof getSavingsAccounts>>[number];

/** A month's deposits and withdrawals across someone's own and joint accounts, cross-filterable. */
export async function getSavingsActivity(
  householdId: string,
  ownerUserId: string,
  month: string,
  filters: SavingsFilters = {},
) {
  const accounts = await db
    .select({ id: savingsAccounts.id })
    .from(savingsAccounts)
    .where(
      and(
        eq(savingsAccounts.householdId, householdId),
        or(eq(savingsAccounts.ownerUserId, ownerUserId), isNull(savingsAccounts.ownerUserId)),
      ),
    );
  const ids = accounts.map((a) => a.id);
  const rows = ids.length
    ? (
        await db.query.savingsTransactions.findMany({
          where: inArray(savingsTransactions.accountId, ids),
          orderBy: [desc(savingsTransactions.date), desc(savingsTransactions.createdAt)],
          with: { account: true, tag: true, user: { columns: { id: true, name: true } } },
        })
      ).filter((t) => t.date.startsWith(`${month}-`))
    : [];

  type Row = (typeof rows)[number];
  const dims: Record<string, Dimension<Row>> = {
    account: { value: (t) => t.accountId, label: (t) => t.account.name },
    tag: { value: (t) => t.tagId, label: (t) => t.tag?.name ?? "" },
    dir: {
      value: (t) => (t.amount >= 0 ? "in" : "out"),
      label: (t) => (t.amount >= 0 ? "Deposits" : "Withdrawals"),
    },
  };
  const explore = crossFilter(rows, dims, filters, (t) => Math.abs(t.amount));

  return {
    transactions: explore.filtered.map((t) => ({
      id: t.id,
      amount: t.amount,
      date: t.date,
      note: t.note,
      accountId: t.accountId,
      accountName: t.account.name,
      tagName: t.tag?.name ?? null,
      userName: t.user.name,
    })),
    facets: explore.facets,
    activeFilters: explore.active,
    net: explore.filtered.reduce((sum, t) => sum + t.amount, 0),
    count: rows.length,
  };
}

/** A savings account and its history, or null if it isn't this household's. */
export async function getSavingsAccount(accountId: string, householdId: string, month: string) {
  const [account] = await db
    .select()
    .from(savingsAccounts)
    .where(and(eq(savingsAccounts.id, accountId), eq(savingsAccounts.householdId, householdId)))
    .limit(1);
  if (!account) return null;
  const transactions = await db.query.savingsTransactions.findMany({
    where: eq(savingsTransactions.accountId, accountId),
    orderBy: [desc(savingsTransactions.date), desc(savingsTransactions.createdAt)],
    with: { tag: true, user: { columns: { id: true, name: true } } },
  });
  return {
    account,
    summary: summarise(account, transactions, month),
    transactions,
  };
}

/** Net deposits into someone's accounts during a month (withdrawals count against). */
export async function savedInMonth(ownerUserId: string, month: string) {
  const rows = await db
    .select({ amount: savingsTransactions.amount })
    .from(savingsTransactions)
    .innerJoin(savingsAccounts, eq(savingsAccounts.id, savingsTransactions.accountId))
    .where(and(eq(savingsAccounts.ownerUserId, ownerUserId), like(savingsTransactions.date, monthPattern(month))));
  return rows.reduce((sum, r) => sum + r.amount, 0);
}

/** Current total across someone's active accounts. */
export async function totalSavingsBalance(ownerUserId: string) {
  const accounts = await db
    .select()
    .from(savingsAccounts)
    .where(and(eq(savingsAccounts.ownerUserId, ownerUserId), eq(savingsAccounts.archived, false)));
  if (!accounts.length) return 0;
  const txs = await db
    .select({ amount: savingsTransactions.amount })
    .from(savingsTransactions)
    .where(
      inArray(
        savingsTransactions.accountId,
        accounts.map((a) => a.id),
      ),
    );
  return accounts.reduce((sum, a) => sum + a.openingBalance, 0) + txs.reduce((sum, t) => sum + t.amount, 0);
}

/** Current total across the household's joint accounts (counted once, not per member). */
export async function totalJointSavingsBalance(householdId: string) {
  const accounts = await db
    .select()
    .from(savingsAccounts)
    .where(and(eq(savingsAccounts.householdId, householdId), isNull(savingsAccounts.ownerUserId), eq(savingsAccounts.archived, false)));
  if (!accounts.length) return 0;
  const txs = await db
    .select({ amount: savingsTransactions.amount })
    .from(savingsTransactions)
    .where(
      inArray(
        savingsTransactions.accountId,
        accounts.map((a) => a.id),
      ),
    );
  return accounts.reduce((sum, a) => sum + a.openingBalance, 0) + txs.reduce((sum, t) => sum + t.amount, 0);
}
