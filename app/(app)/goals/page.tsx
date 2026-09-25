import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getGoalsWithProgress } from "@/lib/data";
import { formatCurrency } from "@/lib/currency";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { NewGoalForm } from "@/components/goals/NewGoalForm";

export default async function GoalsPage() {
  const { household } = await requireSession();
  const goals = await getGoalsWithProgress(household.id);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">Savings goals</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        {goals.map((goal) => (
          <Link key={goal.id} href={`/goals/${goal.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <div className="flex items-baseline justify-between">
                <h3 className="font-medium text-slate-900">{goal.name}</h3>
                <span className="text-sm text-slate-500">{goal.percent}%</span>
              </div>
              <p className="mb-2 text-sm text-slate-600">
                {formatCurrency(goal.saved)} of {formatCurrency(goal.targetAmount)}
              </p>
              <ProgressBar percent={goal.percent} />
              {goal.targetDate && (
                <p className="mt-2 text-xs text-slate-400">
                  Target: {new Date(goal.targetDate).toLocaleDateString("en-ZA")}
                </p>
              )}
            </Card>
          </Link>
        ))}
      </div>

      <Card className="max-w-md">
        <h2 className="mb-4 text-lg font-medium text-slate-800">New goal</h2>
        <NewGoalForm />
      </Card>
    </div>
  );
}
