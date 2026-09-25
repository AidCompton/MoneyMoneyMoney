import Link from "next/link";
import { requireSession } from "@/lib/auth";
import {
  getGoalsWithProgress,
  getBudgetWithExpenses,
  currentMonth,
  getMeetings,
  getCarryOverItems,
} from "@/lib/data";
import { formatCurrency } from "@/lib/currency";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";

export default async function DashboardPage() {
  const { household } = await requireSession();
  const [goals, { budget, spent, remaining }, meetings, carryOver] = await Promise.all([
    getGoalsWithProgress(household.id),
    getBudgetWithExpenses(household.id, currentMonth()),
    getMeetings(household.id),
    getCarryOverItems(household.id),
  ]);

  const latestMeeting = meetings[0];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-slate-800">Savings goals</h2>
          <Link href="/goals" className="text-sm font-medium text-emerald-700 hover:underline">
            View all
          </Link>
        </div>
        {goals.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-600">
              No savings goals yet.{" "}
              <Link href="/goals" className="font-medium text-emerald-700 hover:underline">
                Create your first goal
              </Link>
              .
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {goals.map((goal) => (
              <Card key={goal.id}>
                <div className="flex items-baseline justify-between">
                  <h3 className="font-medium text-slate-900">{goal.name}</h3>
                  <span className="text-sm text-slate-500">{goal.percent}%</span>
                </div>
                <p className="mb-2 text-sm text-slate-600">
                  {formatCurrency(goal.saved)} of {formatCurrency(goal.targetAmount)}
                </p>
                <ProgressBar percent={goal.percent} />
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-slate-800">This month&apos;s groceries</h2>
          <Link href="/budget" className="text-sm font-medium text-emerald-700 hover:underline">
            Manage budget
          </Link>
        </div>
        <Card>
          {budget ? (
            <div>
              <p className="text-sm text-slate-600">
                {formatCurrency(spent)} spent of {formatCurrency(budget.budgetedAmount)}
              </p>
              <p
                className={`text-sm font-medium ${remaining < 0 ? "text-red-600" : "text-slate-800"}`}
              >
                {remaining < 0
                  ? `${formatCurrency(Math.abs(remaining))} over budget`
                  : `${formatCurrency(remaining)} remaining`}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              No budget set for this month yet.{" "}
              <Link href="/budget" className="font-medium text-emerald-700 hover:underline">
                Set one now
              </Link>
              .
            </p>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-slate-800">Money Meeting</h2>
          <Link href="/meetings" className="text-sm font-medium text-emerald-700 hover:underline">
            All meetings
          </Link>
        </div>
        <Card>
          {latestMeeting ? (
            <div className="space-y-1">
              <p className="text-sm text-slate-600">
                Last meeting: {new Date(latestMeeting.date).toLocaleDateString("en-ZA")}
              </p>
              {carryOver.length > 0 && (
                <p className="text-sm font-medium text-amber-700">
                  {carryOver.length} open action item{carryOver.length === 1 ? "" : "s"}
                </p>
              )}
              <Link
                href={`/meetings/${latestMeeting.id}`}
                className="inline-block text-sm font-medium text-emerald-700 hover:underline"
              >
                Open latest meeting
              </Link>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              No meetings logged yet.{" "}
              <Link href="/meetings" className="font-medium text-emerald-700 hover:underline">
                Start this week&apos;s meeting
              </Link>
              .
            </p>
          )}
        </Card>
      </section>
    </div>
  );
}
