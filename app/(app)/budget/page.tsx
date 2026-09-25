import Link from "next/link";
import { addMonths, format, parse } from "date-fns";
import { requireSession } from "@/lib/auth";
import { getBudgetWithExpenses, currentMonth } from "@/lib/data";
import { budgetPercentSpent } from "@/lib/calculations";
import { formatCurrency } from "@/lib/currency";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SetBudgetForm } from "@/components/budget/SetBudgetForm";
import { LogExpenseForm } from "@/components/budget/LogExpenseForm";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { household } = await requireSession();
  const params = await searchParams;
  const month = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonth();

  const monthDate = parse(month, "yyyy-MM", new Date());
  const prevMonth = format(addMonths(monthDate, -1), "yyyy-MM");
  const nextMonth = format(addMonths(monthDate, 1), "yyyy-MM");
  const monthLabel = format(monthDate, "MMMM yyyy");

  const { budget, expenseList, spent, remaining } = await getBudgetWithExpenses(
    household.id,
    month,
  );
  const percentSpent = budget ? budgetPercentSpent(budget.budgetedAmount, spent) : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Grocery budget</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/budget?month=${prevMonth}`} className="text-emerald-700 hover:underline">
            ← Previous
          </Link>
          <span className="font-medium text-slate-700">{monthLabel}</span>
          <Link href={`/budget?month=${nextMonth}`} className="text-emerald-700 hover:underline">
            Next →
          </Link>
        </div>
      </div>

      <Card>
        <SetBudgetForm month={month} defaultAmount={budget?.budgetedAmount} />
      </Card>

      {budget && (
        <>
          <Card>
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-lg font-medium text-slate-900">
                {formatCurrency(spent)}{" "}
                <span className="text-sm font-normal text-slate-500">
                  of {formatCurrency(budget.budgetedAmount)}
                </span>
              </p>
              <span
                className={`text-sm font-medium ${remaining < 0 ? "text-red-600" : "text-slate-500"}`}
              >
                {remaining < 0
                  ? `${formatCurrency(Math.abs(remaining))} over`
                  : `${formatCurrency(remaining)} left`}
              </span>
            </div>
            <ProgressBar percent={percentSpent} />
          </Card>

          <Card className="max-w-xl">
            <h2 className="mb-4 text-lg font-medium text-slate-800">Log an expense</h2>
            <LogExpenseForm budgetId={budget.id} />
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-medium text-slate-800">Expenses this month</h2>
            {expenseList.length === 0 ? (
              <p className="text-sm text-slate-500">No expenses logged yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {expenseList.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium text-slate-800">{e.description}</p>
                      <p className="text-slate-500">
                        {new Date(e.date).toLocaleDateString("en-ZA")} · {e.user.name}
                      </p>
                    </div>
                    <span className="font-medium text-slate-800">{formatCurrency(e.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
