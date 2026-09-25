import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getGoalWithContributions } from "@/lib/data";
import { formatCurrency } from "@/lib/currency";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { GoalProgressChart } from "@/components/goals/GoalProgressChart";
import { AddContributionForm } from "@/components/goals/AddContributionForm";

export default async function GoalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { household } = await requireSession();
  const result = await getGoalWithContributions(id);

  if (!result || result.goal.householdId !== household.id) {
    notFound();
  }

  const { goal, contributions, saved, percent } = result;

  const chronological = [...contributions].reverse();
  const points = chronological.reduce<{ date: string; total: number }[]>((acc, c) => {
    const previousTotal = acc.length > 0 ? acc[acc.length - 1].total : 0;
    acc.push({ date: new Date(c.date).toLocaleDateString("en-ZA"), total: previousTotal + c.amount });
    return acc;
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{goal.name}</h1>
        {goal.targetDate && (
          <p className="text-sm text-slate-500">
            Target date: {new Date(goal.targetDate).toLocaleDateString("en-ZA")}
          </p>
        )}
      </div>

      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-lg font-medium text-slate-900">
            {formatCurrency(saved)}{" "}
            <span className="text-sm font-normal text-slate-500">
              of {formatCurrency(goal.targetAmount)}
            </span>
          </p>
          <span className="text-sm text-slate-500">{percent}%</span>
        </div>
        <ProgressBar percent={percent} />
        <div className="mt-6">
          <GoalProgressChart points={points} targetAmount={goal.targetAmount} />
        </div>
      </Card>

      <Card className="max-w-lg">
        <h2 className="mb-4 text-lg font-medium text-slate-800">Add a contribution</h2>
        <AddContributionForm goalId={goal.id} />
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-medium text-slate-800">Contribution history</h2>
        {contributions.length === 0 ? (
          <p className="text-sm text-slate-500">No contributions logged yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {contributions.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800">
                    {new Date(c.date).toLocaleDateString("en-ZA")} · {c.user.name}
                  </p>
                  {c.note && <p className="text-slate-500">{c.note}</p>}
                </div>
                <span className="font-medium text-emerald-700">{formatCurrency(c.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
