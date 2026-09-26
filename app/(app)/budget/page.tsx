import { requireSession } from "@/lib/auth";
import {
  currentMonth,
  getContributionsForMonth,
  getHouseholdMembers,
  getLabelOptions,
  getSpending,
  getSubcategoryOptions,
} from "@/lib/data";
import { budgetPercentSpent } from "@/lib/calculations";
import { formatCurrency } from "@/lib/currency";
import { formatMonth, monthParam } from "@/lib/dates";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { MonthSwitcher } from "@/components/ui/MonthSwitcher";
import { BudgetPlanForm } from "@/components/budget/BudgetPlanForm";
import { ExpenseForm } from "@/components/budget/ExpenseForm";
import { SpendingBreakdown } from "@/components/budget/SpendingBreakdown";
import { ExpenseExplorer } from "@/components/explore/ExpenseExplorer";
import { CountUp } from "@/components/motion/CountUp";

type Search = { month?: string; cat?: string; sub?: string; store?: string; who?: string };

export default async function BudgetPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { household } = await requireSession();
  const params = await searchParams;
  const month = monthParam(params.month);
  const thisMonth = currentMonth();
  const filters = { cat: params.cat, sub: params.sub, store: params.store, who: params.who };

  const [spending, members] = await Promise.all([
    getSpending({ householdId: household.id, ownerUserId: null, month, filters }),
    getHouseholdMembers(household.id),
  ]);
  const contributions = getContributionsForMonth(household.id, month);
  const paidIn = contributions.reduce((sum, c) => sum + c.amount, 0);

  const { totalPlanned, totalSpent, remaining } = spending;
  const hasPlan = totalPlanned > 0;
  const over = hasPlan && remaining < 0;
  const percentSpent = hasPlan ? budgetPercentSpent(totalPlanned, totalSpent) : 0;

  // Only the current month has "days left".
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const daysLeft = month === thisMonth ? daysInMonth - new Date().getDate() + 1 : null;
  const perDay = hasPlan && daysLeft && remaining > 0 ? Math.floor(remaining / daysLeft) : null;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Shared · Monthly budget" title="Spending," accent={formatMonth(month).split(" ")[0]}>
        <MonthSwitcher basePath="/budget" month={month} params={filters} />
      </PageHeader>

      <Card className="overflow-hidden p-7 sm:p-10">
        <div
          aria-hidden
          className={`pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full blur-3xl ${over ? "bg-coral/20" : "bg-gold/15"}`}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-8">
          <div>
            {hasPlan ? (
              <>
                <p className={`font-display text-[clamp(3rem,8vw,5.5rem)] leading-[0.9] ${over ? "text-coral" : "text-gradient-gold"}`}>
                  <CountUp value={Math.abs(remaining)} />
                </p>
                <p className="mt-3 text-lg text-ivory/60">{over ? "over budget" : "left to spend"} this month</p>
              </>
            ) : (
              <>
                <p className="font-display text-[clamp(3rem,8vw,5.5rem)] leading-[0.9] text-ivory">
                  <CountUp value={totalSpent} />
                </p>
                <p className="mt-3 text-lg text-ivory/60">spent · plan the month below to track what&apos;s left</p>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-10">
            <Stat label="Spent">{formatCurrency(totalSpent)}</Stat>
            <Stat label="Budget">{hasPlan ? formatCurrency(totalPlanned) : "—"}</Stat>
            {perDay !== null ? (
              <Stat label="Per day left" tone="mint">
                {formatCurrency(perDay)}
              </Stat>
            ) : (
              <Stat label="Expenses">{spending.expenseCount}</Stat>
            )}
            <Stat label="Paid in" tone={hasPlan && paidIn < totalPlanned ? "gold" : "ivory"}>
              {formatCurrency(paidIn)}
            </Stat>
          </div>
        </div>
        {hasPlan && (
          <div className="relative mt-8">
            <ProgressBar percent={percentSpent} tone={over ? "over" : "spend"} label="Budget spent" />
          </div>
        )}
        {paidIn > 0 && (
          <p className="relative mt-4 text-sm text-ivory/50">
            Paid into the shared pot:{" "}
            {members
              .map((member) => {
                const amount = contributions.filter((c) => c.userId === member.id).reduce((s, c) => s + c.amount, 0);
                return `${member.name} ${formatCurrency(amount)}`;
              })
              .join(" · ")}
          </p>
        )}
        <div className="relative mt-10 border-t border-white/[0.07] pt-10">
          <SpendingBreakdown categories={spending.categories} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Add an expense</SectionTitle>
          <ExpenseForm
            key={month}
            scope="shared"
            month={month}
            categories={spending.categories.map(({ id, name, color }) => ({ id, name, color }))}
            subcategories={getSubcategoryOptions(household.id, "shared")}
            stores={getLabelOptions(household.id, "store")}
          />
        </Card>
        <Card>
          <SectionTitle>{hasPlan ? `Budget for ${formatMonth(month)}` : `Plan ${formatMonth(month)}`}</SectionTitle>
          <BudgetPlanForm
            key={month}
            scope="shared"
            month={month}
            categories={spending.planCategories}
            planned={spending.planned}
            previousPlanned={spending.previousPlanned}
          />
        </Card>
      </div>

      <ExpenseExplorer spending={spending} basePath="/budget" month={month} canEdit />
    </div>
  );
}
