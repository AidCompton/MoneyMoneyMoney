import Link from "next/link";
import { format } from "date-fns";
import { requireSession } from "@/lib/auth";
import {
  getGoalsWithProgress,
  getBudgetWithExpenses,
  currentMonth,
  getMeetings,
  getCarryOverItems,
  getHouseholdMembers,
} from "@/lib/data";
import { budgetPercentSpent, savingsPace } from "@/lib/calculations";
import { formatCurrency } from "@/lib/currency";
import { formatDay, formatLongDay } from "@/lib/dates";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { LinkButton, Arrow } from "@/components/ui/LinkButton";
import { Stat } from "@/components/ui/Stat";
import { CountUp } from "@/components/motion/CountUp";

function greeting(hour: number) {
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

export default async function DashboardPage() {
  const { user, household } = await requireSession();
  const [goals, { budget, spent, remaining }, meetings, openItems, members] = await Promise.all([
    getGoalsWithProgress(household.id),
    getBudgetWithExpenses(household.id, currentMonth()),
    getMeetings(household.id),
    getCarryOverItems(household.id),
    getHouseholdMembers(household.id),
  ]);

  const now = new Date();
  const [mainGoal, ...otherGoals] = goals;
  const pace = mainGoal ? savingsPace(mainGoal.saved, mainGoal.targetAmount, mainGoal.targetDate) : null;
  const latestMeeting = meetings[0];
  const spentPercent = budget ? budgetPercentSpent(budget.budgetedAmount, spent) : 0;
  const over = remaining < 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Overview · ${format(now, "EEEE d MMMM")}`}
        title={greeting(now.getHours())}
        accent={`${user.name}.`}
      />

      {/* Hero: the main savings goal */}
      {mainGoal ? (
        <Card className="overflow-hidden p-7 sm:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-mint/20 blur-3xl"
          />
          <div className="relative flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <Link
                href={`/goals/${mainGoal.id}`}
                className="group inline-flex items-center gap-2 text-sm font-semibold text-ivory/70 hover:text-ivory"
              >
                <span className="h-2 w-2 rounded-full bg-mint shadow-[0_0_12px] shadow-mint" />
                {mainGoal.name}
                <Arrow />
              </Link>
              <p className="mt-5 font-display text-gradient-mint text-[clamp(3.25rem,10vw,7.5rem)] leading-[0.9]">
                <CountUp value={mainGoal.saved} />
              </p>
              <p className="mt-3 text-lg text-ivory/60">
                saved of <span className="font-semibold text-ivory">{formatCurrency(mainGoal.targetAmount)}</span>
                {mainGoal.targetDate && <> by {formatDay(mainGoal.targetDate)}</>}
              </p>
              <div className="mt-8 max-w-xl">
                <ProgressBar percent={mainGoal.percent} size="lg" label={`${mainGoal.name} progress`} />
              </div>
              <div className="mt-8 grid max-w-xl grid-cols-3 gap-4">
                {pace ? (
                  <>
                    <Stat label="Days left">
                      <CountUp value={pace.daysLeft} format="number" />
                    </Stat>
                    <Stat label="Per month" tone="gold">
                      {formatCurrency(pace.perMonth)}
                    </Stat>
                    <Stat label="Per week" tone="gold">
                      {formatCurrency(pace.perWeek)}
                    </Stat>
                  </>
                ) : (
                  <>
                    <Stat label="Still to go">
                      {formatCurrency(Math.max(0, mainGoal.targetAmount - mainGoal.saved))}
                    </Stat>
                    <Stat label="Contributors">{members.length}</Stat>
                    <Stat label="Goals">{goals.length}</Stat>
                  </>
                )}
              </div>
            </div>
            <div className="self-center">
              <ProgressRing percent={mainGoal.percent} size={250} label="Main goal percent complete">
                <div>
                  <p className="font-display text-6xl text-ivory">
                    <CountUp value={mainGoal.percent} format="percent" />
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-ivory/45">
                    {mainGoal.percent >= 100 ? "Goal reached" : "of the way"}
                  </p>
                </div>
              </ProgressRing>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-8 sm:p-12">
          <p className="font-display text-[clamp(2rem,5vw,3.5rem)] leading-none">
            Set the <span className="font-accent text-gradient-gold">big one.</span>
          </p>
          <p className="mt-4 max-w-md text-ivory/60">
            Start with the goal you&apos;re working toward together — like R100 000 in joint
            savings by the end of the year.
          </p>
          <LinkButton href="/goals" size="lg" className="mt-8">
            Create your first goal <Arrow />
          </LinkButton>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Groceries */}
        <Card className="flex flex-col">
          <SectionTitle
            action={
              <Link href="/budget" className="text-sm font-semibold text-gold hover:underline">
                Budget
              </Link>
            }
          >
            Groceries · {format(now, "MMMM")}
          </SectionTitle>
          {budget ? (
            <div className="flex flex-1 items-center gap-6">
              <ProgressRing percent={spentPercent} size={116} stroke={10} tone={over ? "over" : "spend"} label="Grocery budget spent">
                <span className="text-lg font-bold tabular">
                  <CountUp value={spentPercent} format="percent" />
                </span>
              </ProgressRing>
              <div className="min-w-0">
                <p className={`text-3xl font-bold tracking-tight ${over ? "text-coral" : "text-ivory"}`}>
                  <CountUp value={Math.abs(remaining)} />
                </p>
                <p className="text-sm text-ivory/55">{over ? "over budget" : "left to spend"}</p>
                <p className="mt-2 text-xs text-ivory/40">
                  {formatCurrency(spent)} of {formatCurrency(budget.budgetedAmount)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col justify-between gap-6">
              <p className="text-ivory/60">No grocery budget for this month yet.</p>
              <LinkButton href="/budget" variant="secondary" className="self-start">
                Set this month&apos;s budget
              </LinkButton>
            </div>
          )}
        </Card>

        {/* Money Meeting */}
        <Card className="flex flex-col">
          <SectionTitle
            action={
              <Link href="/meetings" className="text-sm font-semibold text-gold hover:underline">
                All
              </Link>
            }
          >
            Money Meeting
          </SectionTitle>
          {latestMeeting ? (
            <div className="flex flex-1 flex-col justify-between gap-6">
              <div>
                <p className="text-sm text-ivory/50">Last met</p>
                <p className="text-xl font-semibold tracking-tight">{formatLongDay(latestMeeting.date)}</p>
                <p className={`mt-3 text-sm font-semibold ${openItems.length ? "text-gold" : "text-mint"}`}>
                  {openItems.length
                    ? `${openItems.length} open action item${openItems.length === 1 ? "" : "s"}`
                    : "All action items done"}
                </p>
              </div>
              <LinkButton href={`/meetings/${latestMeeting.id}`} variant="secondary" className="self-start">
                Open latest meeting <Arrow />
              </LinkButton>
            </div>
          ) : (
            <div className="flex flex-1 flex-col justify-between gap-6">
              <p className="text-ivory/60">No meetings logged yet.</p>
              <LinkButton href="/meetings" variant="secondary" className="self-start">
                Start this week&apos;s meeting
              </LinkButton>
            </div>
          )}
        </Card>

        {/* Other goals, or an invite nudge */}
        {members.length < 2 ? (
          <Card className="flex flex-col md:col-span-2 lg:col-span-1">
            <SectionTitle>Bring in your partner</SectionTitle>
            <p className="text-sm text-ivory/60">Share this join code so you both see the same numbers.</p>
            <p className="mt-4 font-display tabular text-gradient-gold text-5xl tracking-[0.12em]">
              {household.joinCode}
            </p>
            <Link href="/household" className="mt-auto pt-4 text-sm font-semibold text-gold hover:underline">
              Household settings
            </Link>
          </Card>
        ) : (
          <Card className="flex flex-col md:col-span-2 lg:col-span-1">
            <SectionTitle
              action={
                <Link href="/goals" className="text-sm font-semibold text-gold hover:underline">
                  Goals
                </Link>
              }
            >
              Other goals
            </SectionTitle>
            {otherGoals.length === 0 ? (
              <p className="text-sm text-ivory/55">
                Just the one for now. Add more, like an emergency fund or a holiday.
              </p>
            ) : (
              <ul className="space-y-4">
                {otherGoals.map((goal) => (
                  <li key={goal.id}>
                    <Link href={`/goals/${goal.id}`} className="block space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold">{goal.name}</span>
                        <span className="text-ivory/50 tabular">{goal.percent}%</span>
                      </div>
                      <ProgressBar percent={goal.percent} size="sm" label={`${goal.name} progress`} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
