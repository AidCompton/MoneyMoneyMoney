import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getGoalWithContributions } from "@/lib/data";
import { savingsPace } from "@/lib/calculations";
import { formatCurrency } from "@/lib/currency";
import { formatDay } from "@/lib/dates";
import { deleteContribution, deleteGoal } from "@/lib/actions/goals";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { Stat } from "@/components/ui/Stat";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { BalanceChart } from "@/components/charts/BalanceChart";
import { AddContributionForm } from "@/components/goals/AddContributionForm";
import { EditGoalForm } from "@/components/goals/EditGoalForm";
import { CountUp } from "@/components/motion/CountUp";

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
  const pace = savingsPace(saved, goal.targetAmount, goal.targetDate);
  const toGo = Math.max(0, goal.targetAmount - saved);

  const chronological = [...contributions].reverse();
  const points = chronological.reduce<{ date: string; total: number }[]>((acc, c) => {
    const previousTotal = acc.length > 0 ? acc[acc.length - 1].total : 0;
    acc.push({ date: formatDay(c.date), total: previousTotal + c.amount });
    return acc;
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Savings goal" title={goal.name}>
        <Link href="/goals" className="text-sm font-semibold text-gold hover:underline">
          ← All goals
        </Link>
      </PageHeader>

      <Card className="overflow-hidden p-7 sm:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-mint/15 blur-3xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="font-display text-gradient-mint text-[clamp(3rem,9vw,6.5rem)] leading-[0.9]">
              <CountUp value={saved} />
            </p>
            <p className="mt-3 text-lg text-ivory/60">
              of <span className="font-semibold text-ivory">{formatCurrency(goal.targetAmount)}</span>
              {goal.targetDate && <> by {formatDay(goal.targetDate)}</>}
            </p>
          </div>
          <p className="font-display text-6xl text-ivory/90">
            <CountUp value={percent} format="percent" />
          </p>
        </div>
        <div className="relative mt-8">
          <ProgressBar percent={percent} size="lg" label={`${goal.name} progress`} />
        </div>
        <div className="relative mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Still to go">{formatCurrency(toGo)}</Stat>
          <Stat label="Contributions">{contributions.length}</Stat>
          {pace ? (
            <>
              <Stat label="Needed / month" tone="gold">
                {formatCurrency(pace.perMonth)}
              </Stat>
              <Stat label="Days left">{pace.daysLeft}</Stat>
            </>
          ) : (
            <Stat label="Target date">{goal.targetDate ? "Passed" : "Not set"}</Stat>
          )}
        </div>
        <div className="relative mt-10 -mx-2">
          <BalanceChart points={points.length ? [{ date: "Start", total: 0 }, ...points] : []} target={goal.targetAmount} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <SectionTitle>Add a contribution</SectionTitle>
          <AddContributionForm goalId={goal.id} />
        </Card>

        <Card className="lg:col-span-3">
          <SectionTitle>History</SectionTitle>
          {contributions.length === 0 ? (
            <p className="text-ivory/55">No contributions logged yet.</p>
          ) : (
            <ul className="divide-y divide-white/[0.07]">
              {contributions.map((c) => (
                <li key={c.id} className="row-enter flex items-center gap-4 py-3.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mint/10 text-sm font-bold text-mint ring-1 ring-mint/20">
                    {c.user.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.note || "Contribution"}</p>
                    <p className="text-sm text-ivory/45">
                      {formatDay(c.date)} · {c.user.name}
                    </p>
                  </div>
                  <span className="font-semibold tabular text-mint">+{formatCurrency(c.amount)}</span>
                  <form action={deleteContribution.bind(null, c.id)}>
                    <ConfirmButton icon label="Delete contribution" />
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle
          action={
            <form action={deleteGoal.bind(null, goal.id)}>
              <ConfirmButton label="Delete goal" confirmLabel="Delete goal and its history?" />
            </form>
          }
        >
          Goal settings
        </SectionTitle>
        <EditGoalForm goal={goal} />
      </Card>
    </div>
  );
}
