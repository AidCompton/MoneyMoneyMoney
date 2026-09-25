import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getGoalsWithProgress } from "@/lib/data";
import { formatCurrency } from "@/lib/currency";
import { formatDay } from "@/lib/dates";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { Arrow } from "@/components/ui/LinkButton";
import { NewGoalForm } from "@/components/goals/NewGoalForm";
import { CountUp } from "@/components/motion/CountUp";

export default async function GoalsPage() {
  const { household } = await requireSession();
  const goals = await getGoalsWithProgress(household.id);
  const totalSaved = goals.reduce((sum, g) => sum + g.saved, 0);

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Savings goals" title="Build it" accent="together.">
        {goals.length > 0 && (
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ivory/45">
              Saved across all goals
            </p>
            <p className="font-display text-4xl text-gold">
              <CountUp value={totalSaved} />
            </p>
          </div>
        )}
      </PageHeader>

      {goals.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {goals.map((goal, i) => (
            <Link key={goal.id} href={`/goals/${goal.id}`} data-reveal className="group block min-w-0">
              <div className="glass relative h-full overflow-hidden rounded-[28px] p-7 transition-transform duration-500 ease-out group-hover:-translate-y-1">
                <div
                  aria-hidden
                  className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl transition-opacity duration-500 group-hover:opacity-100 ${
                    i % 2 ? "bg-gold/15" : "bg-mint/15"
                  } opacity-60`}
                />
                <div className="relative flex items-start justify-between gap-4">
                  <h3 className="text-xl font-semibold tracking-tight">{goal.name}</h3>
                  <span className="rounded-full bg-white/[0.07] px-3 py-1 text-sm font-semibold tabular text-ivory/80">
                    {goal.percent}%
                  </span>
                </div>
                <p className="relative mt-6 font-display text-5xl text-ivory">
                  <CountUp value={goal.saved} />
                </p>
                <p className="relative mt-2 text-sm text-ivory/55">
                  of {formatCurrency(goal.targetAmount)}
                  {goal.targetDate && <> · by {formatDay(goal.targetDate)}</>}
                </p>
                <div className="relative mt-6">
                  <ProgressBar percent={goal.percent} label={`${goal.name} progress`} />
                </div>
                <p className="relative mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold">
                  Open goal <Arrow />
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Card className="max-w-2xl">
        <SectionTitle>{goals.length ? "Start another goal" : "Your first goal"}</SectionTitle>
        <NewGoalForm />
      </Card>
    </div>
  );
}
