import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getHouseholdMembers, getLabelOptions, getSavingsAccounts, getSavingsActivity } from "@/lib/data";
import { formatCurrency } from "@/lib/currency";
import { formatMonth, monthParam } from "@/lib/dates";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { MonthSwitcher } from "@/components/ui/MonthSwitcher";
import { Arrow } from "@/components/ui/LinkButton";
import { Sparkline } from "@/components/savings/Sparkline";
import { AccountForm } from "@/components/savings/AccountForm";
import { TransactionForm } from "@/components/savings/TransactionForm";
import { SavingsActivity } from "@/components/savings/SavingsActivity";
import { ReadOnlyNote } from "@/components/personal/ReadOnlyNote";
import { CountUp } from "@/components/motion/CountUp";

type Search = { month?: string; account?: string; tag?: string; dir?: string };

export default async function SavingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Search>;
}) {
  const { userId } = await params;
  const search = await searchParams;
  const { user, household } = await requireSession();
  const person = (await getHouseholdMembers(household.id)).find((m) => m.id === userId);
  if (!person) notFound();

  const isOwner = person.id === user.id;
  const month = monthParam(search.month);
  const filters = { account: search.account, tag: search.tag, dir: search.dir };
  const basePath = `/personal/${person.id}/savings`;
  const [accounts, activity] = await Promise.all([
    getSavingsAccounts(household.id, person.id, month),
    getSavingsActivity(household.id, person.id, month, filters),
  ]);
  const total = accounts.reduce((sum, a) => sum + a.balance, 0);
  const thisMonth = accounts.reduce((sum, a) => sum + a.thisMonth, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        tone="mint"
        eyebrow={`Personal · ${isOwner ? "Your" : `${person.name}'s`} savings`}
        title="Savings,"
        accent="growing."
      >
        <MonthSwitcher basePath={basePath} month={month} params={filters} />
      </PageHeader>

      {!isOwner && <ReadOnlyNote name={person.name} />}

      <Card className="overflow-hidden p-7 sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-mint/15 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="font-display text-gradient-mint text-[clamp(3rem,9vw,6.5rem)] leading-[0.9]">
              <CountUp value={total} />
            </p>
            <p className="mt-3 text-lg text-ivory/60">
              saved across {accounts.length} account{accounts.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <Stat label={`In ${formatMonth(month).split(" ")[0]}`} tone={thisMonth < 0 ? "coral" : "mint"}>
              {thisMonth < 0 ? "−" : "+"}
              {formatCurrency(Math.abs(thisMonth))}
            </Stat>
            <Stat label="Accounts">{accounts.length}</Stat>
          </div>
        </div>
      </Card>

      {accounts.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <Link key={a.id} href={`${basePath}/${a.id}`} data-reveal className="group block min-w-0">
              <div className="glass relative h-full overflow-hidden rounded-[28px] p-6 transition-transform duration-500 ease-out group-hover:-translate-y-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-lg font-semibold tracking-tight">{a.name}</h3>
                      {a.joint && (
                        <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold">
                          Joint
                        </span>
                      )}
                    </div>
                    {a.institution && <p className="truncate text-sm text-ivory/45">{a.institution}</p>}
                  </div>
                  <Sparkline values={a.series.map((p) => p.balance)} width={96} height={32} />
                </div>
                <p className="mt-5 font-display text-4xl">
                  <CountUp value={a.balance} />
                </p>
                <p className={`mt-1 text-sm ${a.thisMonth < 0 ? "text-coral" : "text-mint"}`}>
                  {a.thisMonth < 0 ? "−" : "+"}
                  {formatCurrency(Math.abs(a.thisMonth))} this month
                </p>
                {a.targetAmount ? (
                  <div className="mt-5 space-y-2">
                    <div className="flex justify-between text-xs text-ivory/50">
                      <span>Target {formatCurrency(a.targetAmount)}</span>
                      <span className="tabular">{a.percent}%</span>
                    </div>
                    <ProgressBar percent={a.percent ?? 0} size="sm" label={`${a.name} progress`} />
                  </div>
                ) : null}
                <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-mint">
                  Open <Arrow />
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {isOwner && (
        <div className="grid gap-6 lg:grid-cols-2">
          {accounts.length > 0 && (
            <Card>
              <SectionTitle>Deposit or withdraw</SectionTitle>
              <TransactionForm
                key={month}
                month={month}
                accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
                tags={getLabelOptions(household.id, "savings_tag")}
              />
            </Card>
          )}
          <Card>
            <SectionTitle>{accounts.length ? "Add another account" : "Add your first savings account"}</SectionTitle>
            <AccountForm />
          </Card>
        </div>
      )}

      {!isOwner && accounts.length === 0 && (
        <Card>
          <p className="text-ivory/55">{person.name} hasn&apos;t added any savings accounts yet.</p>
        </Card>
      )}

      {accounts.length > 0 && (
        <SavingsActivity activity={activity} basePath={basePath} month={month} canEdit={isOwner} />
      )}
    </div>
  );
}
