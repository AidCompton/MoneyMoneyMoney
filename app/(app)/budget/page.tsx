import Link from "next/link";
import { addMonths, format, parse } from "date-fns";
import { requireSession } from "@/lib/auth";
import { getMonthSpending, currentMonth } from "@/lib/data";
import { budgetPercentSpent } from "@/lib/calculations";
import { categoryColor } from "@/lib/categories";
import { formatCurrency } from "@/lib/currency";
import { formatDay } from "@/lib/dates";
import { deleteExpense } from "@/lib/actions/budget";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { BudgetPlanForm } from "@/components/budget/BudgetPlanForm";
import { LogExpenseForm } from "@/components/budget/LogExpenseForm";
import { SpendingBreakdown } from "@/components/budget/SpendingBreakdown";
import { CountUp } from "@/components/motion/CountUp";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { household } = await requireSession();
  const params = await searchParams;
  const thisMonth = currentMonth();
  const month = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : thisMonth;

  const monthDate = parse(month, "yyyy-MM", new Date());
  const prevMonth = format(addMonths(monthDate, -1), "yyyy-MM");
  const nextMonth = format(addMonths(monthDate, 1), "yyyy-MM");
  const monthLabel = format(monthDate, "MMMM yyyy");

  const { categories, expenseList, totalPlanned, totalSpent, remaining } = await getMonthSpending(
    household.id,
    month,
  );
  const hasPlan = totalPlanned > 0;
  const over = hasPlan && remaining < 0;
  const percentSpent = hasPlan ? budgetPercentSpent(totalPlanned, totalSpent) : 0;

  // Only the current month has "days left".
  const today = new Date();
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const daysLeft = month === thisMonth ? daysInMonth - today.getDate() + 1 : null;
  const perDay = hasPlan && daysLeft && remaining > 0 ? Math.floor(remaining / daysLeft) : null;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Monthly budget" title="Spending," accent={format(monthDate, "MMMM")}>
        <div className="glass flex items-center gap-1 rounded-full p-1">
          <Link
            href={`/budget?month=${prevMonth}`}
            aria-label="Previous month"
            className="grid h-10 w-10 place-items-center rounded-full text-ivory/70 transition-colors hover:bg-white/10 hover:text-ivory"
          >
            ←
          </Link>
          <span className="min-w-32 px-2 text-center text-sm font-semibold">{monthLabel}</span>
          <Link
            href={`/budget?month=${nextMonth}`}
            aria-label="Next month"
            className="grid h-10 w-10 place-items-center rounded-full text-ivory/70 transition-colors hover:bg-white/10 hover:text-ivory"
          >
            →
          </Link>
        </div>
      </PageHeader>

      {/* Headline + where the money went */}
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
                <p className="mt-3 text-lg text-ivory/60">
                  {over ? "over budget" : "left to spend"} this month
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-[clamp(3rem,8vw,5.5rem)] leading-[0.9] text-ivory">
                  <CountUp value={totalSpent} />
                </p>
                <p className="mt-3 text-lg text-ivory/60">spent · set a budget below to track what&apos;s left</p>
              </>
            )}
          </div>
          <div className="grid grid-cols-3 gap-6 sm:gap-10">
            <Stat label="Spent">{formatCurrency(totalSpent)}</Stat>
            <Stat label="Budget">{hasPlan ? formatCurrency(totalPlanned) : "—"}</Stat>
            {perDay !== null ? (
              <Stat label="Per day left" tone="mint">
                {formatCurrency(perDay)}
              </Stat>
            ) : (
              <Stat label="Expenses">{expenseList.length}</Stat>
            )}
          </div>
        </div>
        {hasPlan && (
          <div className="relative mt-8">
            <ProgressBar percent={percentSpent} tone={over ? "over" : "spend"} label="Budget spent" />
          </div>
        )}
        <div className="relative mt-10 border-t border-white/[0.07] pt-10">
          <SpendingBreakdown categories={categories} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Add an expense</SectionTitle>
          <LogExpenseForm key={month} month={month} />
        </Card>
        <Card>
          <SectionTitle>{hasPlan ? `Budget for ${monthLabel}` : `Plan ${monthLabel}`}</SectionTitle>
          <BudgetPlanForm
            key={month}
            month={month}
            planned={Object.fromEntries(categories.map((c) => [c.name, c.planned]))}
          />
        </Card>
      </div>

      <Card>
        <SectionTitle>Expenses · {expenseList.length}</SectionTitle>
        {expenseList.length === 0 ? (
          <p className="text-ivory/55">Nothing logged for {monthLabel} yet.</p>
        ) : (
          <ul className="divide-y divide-white/[0.07]">
            {expenseList.map((e) => (
              <li key={e.id} className="row-enter flex items-center gap-4 py-3.5">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: categoryColor(e.category) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.description}</p>
                  <p className="truncate text-sm text-ivory/45">
                    {e.category} · {formatDay(e.date)} · {e.user.name}
                  </p>
                </div>
                <span className="font-semibold tabular">{formatCurrency(e.amount)}</span>
                <form action={deleteExpense.bind(null, e.id)}>
                  <ConfirmButton icon label="Delete expense" />
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
