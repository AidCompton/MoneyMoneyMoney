import Link from "next/link";
import { addMonths, format, parse } from "date-fns";
import { requireSession } from "@/lib/auth";
import { getBudgetWithExpenses, currentMonth } from "@/lib/data";
import { budgetPercentSpent } from "@/lib/calculations";
import { formatCurrency } from "@/lib/currency";
import { formatDay } from "@/lib/dates";
import { deleteExpense } from "@/lib/actions/budget";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { SetBudgetForm } from "@/components/budget/SetBudgetForm";
import { LogExpenseForm } from "@/components/budget/LogExpenseForm";
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

  const { budget, expenseList, spent, remaining } = await getBudgetWithExpenses(household.id, month);
  const percentSpent = budget ? budgetPercentSpent(budget.budgetedAmount, spent) : 0;
  const over = remaining < 0;

  // Only this month has "days left"; past and future months don't.
  const today = new Date();
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const daysLeft = month === thisMonth ? daysInMonth - today.getDate() + 1 : null;
  const perDay = budget && daysLeft && remaining > 0 ? Math.floor(remaining / daysLeft) : null;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Monthly budget" title="Groceries," accent={format(monthDate, "MMMM")}>
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

      {budget && (
        <Card className="overflow-hidden p-7 sm:p-10">
          <div
            aria-hidden
            className={`pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full blur-3xl ${over ? "bg-coral/20" : "bg-gold/15"}`}
          />
          <div className="relative flex flex-col gap-10 md:flex-row md:items-center">
            <ProgressRing percent={percentSpent} size={200} tone={over ? "over" : "spend"} label="Budget spent">
              <div>
                <p className="font-display text-5xl">
                  <CountUp value={percentSpent} format="percent" />
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ivory/45">spent</p>
              </div>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <p className={`font-display text-[clamp(3rem,8vw,5.5rem)] leading-[0.9] ${over ? "text-coral" : "text-gradient-gold"}`}>
                <CountUp value={Math.abs(remaining)} />
              </p>
              <p className="mt-3 text-lg text-ivory/60">{over ? "over budget" : "left"}</p>
              <div className="mt-6">
                <ProgressBar percent={percentSpent} tone={over ? "over" : "spend"} label="Budget spent" />
              </div>
              <div className="mt-8 grid grid-cols-3 gap-6">
                <Stat label="Spent">{formatCurrency(spent)}</Stat>
                <Stat label="Budget">{formatCurrency(budget.budgetedAmount)}</Stat>
                {perDay !== null ? (
                  <Stat label="Per day left" tone="mint">
                    {formatCurrency(perDay)}
                  </Stat>
                ) : (
                  <Stat label="Expenses">{expenseList.length}</Stat>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle>{budget ? "Adjust the budget" : `Set a budget for ${monthLabel}`}</SectionTitle>
        <SetBudgetForm month={month} monthLabel={monthLabel} defaultAmount={budget?.budgetedAmount} />
      </Card>

      {budget && (
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-2">
            <SectionTitle>Log an expense</SectionTitle>
            <LogExpenseForm budgetId={budget.id} />
          </Card>

          <Card className="lg:col-span-3">
            <SectionTitle>Expenses · {expenseList.length}</SectionTitle>
            {expenseList.length === 0 ? (
              <p className="text-ivory/55">No expenses logged yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.07]">
                {expenseList.map((e) => (
                  <li key={e.id} className="row-enter flex items-center gap-4 py-3.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/10 text-sm font-bold text-gold ring-1 ring-gold/20">
                      {e.user.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{e.description}</p>
                      <p className="text-sm text-ivory/45">
                        {formatDay(e.date)} · {e.user.name}
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
      )}
    </div>
  );
}
