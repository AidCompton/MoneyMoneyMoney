import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import {
  getCategoryOptions,
  getHouseholdMembers,
  getLabelOptions,
  getPersonalMonth,
  getSubcategoryOptions,
  totalSavingsBalance,
} from "@/lib/data";
import { budgetPercentSpent } from "@/lib/calculations";
import { FLOW } from "@/lib/categories";
import { formatCurrency } from "@/lib/currency";
import { formatDay, formatMonth, monthParam } from "@/lib/dates";
import { deleteIncome, deleteSharedContribution } from "@/lib/actions/personal";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { MonthSwitcher } from "@/components/ui/MonthSwitcher";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Arrow } from "@/components/ui/LinkButton";
import { FlowBar } from "@/components/charts/FlowBar";
import { BudgetPlanForm } from "@/components/budget/BudgetPlanForm";
import { ExpenseForm } from "@/components/budget/ExpenseForm";
import { SpendingBreakdown } from "@/components/budget/SpendingBreakdown";
import { ExpenseExplorer } from "@/components/explore/ExpenseExplorer";
import { IncomeForm } from "@/components/personal/IncomeForm";
import { ContributionForm } from "@/components/personal/ContributionForm";
import { CountUp } from "@/components/motion/CountUp";
import { ReadOnlyNote } from "@/components/personal/ReadOnlyNote";

type Search = { month?: string; cat?: string; sub?: string; store?: string };

export default async function PersonalBudgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Search>;
}) {
  const { userId } = await params;
  const search = await searchParams;
  const { user, household } = await requireSession();
  const members = await getHouseholdMembers(household.id);
  const person = members.find((m) => m.id === userId);
  if (!person) notFound();

  const isOwner = person.id === user.id;
  const month = monthParam(search.month);
  const filters = { cat: search.cat, sub: search.sub, store: search.store };
  const basePath = `/personal/${person.id}`;

  const { spending, flow, incomes, contributions } = await getPersonalMonth(household.id, person.id, month, filters);
  const savingsBalance = totalSavingsBalance(person.id);
  const monthName = formatMonth(month).split(" ")[0];
  const overspent = flow.left < 0;
  const hasPlan = spending.totalPlanned > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        tone="mint"
        eyebrow={`Personal · ${isOwner ? "You" : person.name}`}
        title={isOwner ? "Your money," : `${person.name}'s money,`}
        accent={monthName}
      >
        <MonthSwitcher basePath={basePath} month={month} params={filters} />
      </PageHeader>

      {!isOwner && <ReadOnlyNote name={person.name} />}

      {/* Where this month's money went */}
      <Card className="overflow-hidden p-7 sm:p-10">
        <div
          aria-hidden
          className={`pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full blur-3xl ${overspent ? "bg-coral/20" : "bg-mint/15"}`}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-8">
          <div>
            <p
              className={`font-display text-[clamp(3rem,8vw,5.5rem)] leading-[0.9] ${
                overspent ? "text-coral" : "text-gradient-mint"
              }`}
            >
              <CountUp value={Math.abs(flow.left)} />
            </p>
            <p className="mt-3 text-lg text-ivory/60">
              {flow.income === 0 && flow.spent + flow.saved + flow.contributed === 0
                ? `nothing logged for ${monthName} yet`
                : overspent
                  ? "more went out than came in"
                  : "left over this month"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 sm:gap-10">
            <Stat label="Income">{formatCurrency(flow.income)}</Stat>
            <Stat label="Savings rate" tone="mint">
              {flow.savingsRate}%
            </Stat>
            <Stat label="Personal budget">{hasPlan ? formatCurrency(spending.totalPlanned) : "—"}</Stat>
          </div>
        </div>
        <div className="relative mt-10">
          <FlowBar
            whole={flow.income || undefined}
            segments={[
              { key: "spent", label: "Spent", value: flow.spent, color: FLOW.spent },
              { key: "shared", label: "Paid into shared", value: flow.contributed, color: FLOW.shared },
              { key: "saved", label: "Saved", value: flow.saved, color: FLOW.saved },
              { key: "left", label: "Left over", value: Math.max(0, flow.left), color: FLOW.left },
            ]}
          />
        </div>
        {flow.income === 0 && (flow.spent > 0 || flow.saved > 0 || flow.contributed > 0) && (
          <p className="relative mt-5 text-sm text-ivory/50">Add this month&apos;s income to see what share each part is.</p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <SectionTitle>Income</SectionTitle>
          <MoneyList
            empty="No income logged this month."
            rows={incomes.map((i) => ({
              id: i.id,
              title: i.sourceName ?? "Income",
              meta: [formatDay(i.date), i.note].filter(Boolean).join(" · "),
              amount: i.amount,
              remove: isOwner ? deleteIncome.bind(null, i.id) : undefined,
            }))}
            tone="mint"
          />
          {isOwner && (
            <div className="mt-6 border-t border-white/[0.07] pt-6">
              <IncomeForm key={month} month={month} sources={getLabelOptions(household.id, "income_source")} />
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle>Paid into shared</SectionTitle>
          <p className="-mt-2 mb-4 text-sm text-ivory/50">
            Money moved from {isOwner ? "your" : `${person.name}'s`} own funds into the shared pot.
          </p>
          <MoneyList
            empty="Nothing paid in this month."
            rows={contributions.map((c) => ({
              id: c.id,
              title: c.note ?? "Shared pot",
              meta: formatDay(c.date),
              amount: c.amount,
              remove: isOwner ? deleteSharedContribution.bind(null, c.id) : undefined,
            }))}
          />
          {isOwner && (
            <div className="mt-6 border-t border-white/[0.07] pt-6">
              <ContributionForm key={month} month={month} />
            </div>
          )}
        </Card>

        <Card className="flex flex-col">
          <SectionTitle>Savings</SectionTitle>
          <p className="font-display text-5xl text-gradient-mint">
            <CountUp value={savingsBalance} />
          </p>
          <p className="mt-2 text-sm text-ivory/55">across {isOwner ? "your" : `${person.name}'s`} savings accounts</p>
          <p className={`mt-6 text-sm font-semibold ${flow.saved < 0 ? "text-coral" : "text-mint"}`}>
            {flow.saved >= 0 ? "+" : "−"}
            {formatCurrency(Math.abs(flow.saved))} {flow.saved < 0 ? "taken out" : "saved"} in {monthName}
          </p>
          <Link
            href={`${basePath}/savings?month=${month}`}
            className="group mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-mint hover:underline"
          >
            Open savings <Arrow />
          </Link>
        </Card>
      </div>

      <Card className="p-7 sm:p-10">
        <SectionTitle>
          {isOwner ? "Your" : `${person.name}'s`} spending
        </SectionTitle>
        {hasPlan && (
          <div className="mb-8 max-w-xl">
            <div className="mb-2 flex justify-between text-sm text-ivory/55">
              <span>
                {formatCurrency(spending.totalSpent)} of {formatCurrency(spending.totalPlanned)}
              </span>
              <span className={spending.remaining < 0 ? "text-coral" : ""}>
                {spending.remaining < 0
                  ? `${formatCurrency(-spending.remaining)} over`
                  : `${formatCurrency(spending.remaining)} left`}
              </span>
            </div>
            <ProgressBar
              percent={budgetPercentSpent(spending.totalPlanned, spending.totalSpent)}
              tone={spending.remaining < 0 ? "over" : "spend"}
              label="Personal budget spent"
            />
          </div>
        )}
        {spending.categories.length === 0 ? (
          <p className="text-ivory/55">
            {isOwner
              ? "No personal budget or spending yet this month. Plan a category or add an expense below."
              : `Nothing planned or spent yet this month.`}
          </p>
        ) : (
          <SpendingBreakdown categories={spending.categories} />
        )}
      </Card>

      {isOwner && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <SectionTitle>Add an expense</SectionTitle>
            <ExpenseForm
              key={month}
              scope="personal"
              month={month}
              categories={getCategoryOptions(household.id, "personal")}
              subcategories={getSubcategoryOptions(household.id, "personal")}
              stores={getLabelOptions(household.id, "store")}
            />
          </Card>
          <Card>
            <SectionTitle>Plan {formatMonth(month)}</SectionTitle>
            <BudgetPlanForm
              key={month}
              scope="personal"
              month={month}
              categories={spending.planCategories}
              planned={spending.planned}
              previousPlanned={spending.previousPlanned}
              categoryOptions={getCategoryOptions(household.id, "personal")}
            />
          </Card>
        </div>
      )}

      <ExpenseExplorer spending={spending} basePath={basePath} month={month} canEdit={isOwner} />
    </div>
  );
}

function MoneyList({
  rows,
  empty,
  tone = "ivory",
}: {
  rows: { id: string; title: string; meta: string; amount: number; remove?: () => Promise<void> }[];
  empty: string;
  tone?: "ivory" | "mint";
}) {
  if (rows.length === 0) return <p className="text-sm text-ivory/50">{empty}</p>;
  return (
    <ul className="divide-y divide-white/[0.07]">
      {rows.map((r) => (
        <li key={r.id} className="row-enter flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{r.title}</p>
            <p className="truncate text-sm text-ivory/45">{r.meta}</p>
          </div>
          <span className={`font-semibold tabular ${tone === "mint" ? "text-mint" : ""}`}>
            {formatCurrency(r.amount)}
          </span>
          {r.remove && (
            <form action={r.remove}>
              <ConfirmButton icon label={`Delete ${r.title}`} />
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
