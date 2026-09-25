import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { currentMonth, getHouseholdMembers, getLabelOptions, getSavingsAccount } from "@/lib/data";
import { formatCurrency } from "@/lib/currency";
import { formatDay } from "@/lib/dates";
import { deleteSavingsAccount, deleteSavingsTransaction } from "@/lib/actions/savings";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { BalanceChart } from "@/components/charts/BalanceChart";
import { AccountForm } from "@/components/savings/AccountForm";
import { TransactionForm } from "@/components/savings/TransactionForm";
import { ReadOnlyNote } from "@/components/personal/ReadOnlyNote";
import { CountUp } from "@/components/motion/CountUp";

export default async function SavingsAccountPage({
  params,
}: {
  params: Promise<{ userId: string; accountId: string }>;
}) {
  const { userId, accountId } = await params;
  const { user, household } = await requireSession();
  const person = (await getHouseholdMembers(household.id)).find((m) => m.id === userId);
  const result = await getSavingsAccount(accountId, currentMonth());
  if (!person || !result || result.account.ownerUserId !== person.id) notFound();

  const { account, summary, transactions } = result;
  const isOwner = person.id === user.id;
  const points = summary.series.map((p) => ({ date: p.opening ? "Opened" : formatDay(p.date), total: p.balance }));
  const deposits = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const withdrawals = transactions.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);

  return (
    <div className="space-y-8">
      <PageHeader tone="mint" eyebrow={`Savings account${account.institution ? ` · ${account.institution}` : ""}`} title={account.name}>
        <Link href={`/personal/${person.id}/savings`} className="text-sm font-semibold text-mint hover:underline">
          ← All savings
        </Link>
      </PageHeader>

      {!isOwner && <ReadOnlyNote name={person.name} />}

      <Card className="overflow-hidden p-7 sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-mint/15 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="font-display text-gradient-mint text-[clamp(3rem,9vw,6.5rem)] leading-[0.9]">
              <CountUp value={summary.balance} />
            </p>
            <p className="mt-3 text-lg text-ivory/60">
              balance
              {account.targetAmount ? (
                <>
                  {" "}
                  of <span className="font-semibold text-ivory">{formatCurrency(account.targetAmount)}</span> target
                </>
              ) : null}
            </p>
          </div>
          {summary.percent !== null && (
            <p className="font-display text-6xl text-ivory/90">
              <CountUp value={summary.percent} format="percent" />
            </p>
          )}
        </div>
        {summary.percent !== null && (
          <div className="relative mt-8">
            <ProgressBar percent={summary.percent} size="lg" label={`${account.name} progress`} />
          </div>
        )}
        <div className="relative mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Started with">{formatCurrency(account.openingBalance)}</Stat>
          <Stat label="Deposited" tone="mint">
            {formatCurrency(deposits)}
          </Stat>
          <Stat label="Withdrawn" tone={withdrawals > 0 ? "coral" : "ivory"}>
            {formatCurrency(withdrawals)}
          </Stat>
          <Stat label="Since">{formatDay(account.openingDate)}</Stat>
        </div>
        <div className="relative -mx-2 mt-10">
          <BalanceChart
            points={points.length > 1 ? points : []}
            target={account.targetAmount}
            seriesName="Balance"
            tone="mint"
            empty="The balance will chart here as you add deposits."
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        {isOwner && (
          <Card className="lg:col-span-2">
            <SectionTitle>Deposit or withdraw</SectionTitle>
            <TransactionForm accounts={[{ id: account.id, name: account.name }]} tags={getLabelOptions(household.id, "savings_tag")} />
          </Card>
        )}
        <Card className={isOwner ? "lg:col-span-3" : "lg:col-span-5"}>
          <SectionTitle>History</SectionTitle>
          {transactions.length === 0 ? (
            <p className="text-ivory/55">No deposits or withdrawals yet.</p>
          ) : (
            <ul className="divide-y divide-white/[0.07]">
              {transactions.map((t) => (
                <li key={t.id} className="row-enter flex items-center gap-4 py-3.5">
                  <span
                    aria-hidden
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      t.amount < 0 ? "bg-coral/10 text-coral" : "bg-mint/10 text-mint"
                    }`}
                  >
                    {t.amount < 0 ? "↓" : "↑"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.tag?.name ?? (t.amount < 0 ? "Withdrawal" : "Deposit")}</p>
                    <p className="truncate text-sm text-ivory/45">
                      {formatDay(t.date)}
                      {t.note && ` · ${t.note}`}
                    </p>
                  </div>
                  <span className={`font-semibold tabular ${t.amount < 0 ? "text-coral" : "text-mint"}`}>
                    {t.amount < 0 ? "−" : "+"}
                    {formatCurrency(Math.abs(t.amount))}
                  </span>
                  {isOwner && (
                    <form action={deleteSavingsTransaction.bind(null, t.id)}>
                      <ConfirmButton icon label="Delete entry" />
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {isOwner && (
        <Card>
          <SectionTitle
            action={
              <form action={deleteSavingsAccount.bind(null, account.id)}>
                <ConfirmButton label="Delete account" confirmLabel="Delete account and its history?" />
              </form>
            }
          >
            Account settings
          </SectionTitle>
          <AccountForm account={account} />
        </Card>
      )}
    </div>
  );
}
