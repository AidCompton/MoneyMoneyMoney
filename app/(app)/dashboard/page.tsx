import Link from "next/link";
import { format } from "date-fns";
import { requireSession } from "@/lib/auth";
import {
  currentMonth,
  getCarryOverItems,
  getGroceryMonth,
  getHouseholdOverview,
  getMeetings,
} from "@/lib/data";
import { savingsPace } from "@/lib/calculations";
import { FLOW } from "@/lib/categories";
import { formatCurrency } from "@/lib/currency";
import { formatDay, formatLongDay } from "@/lib/dates";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { LinkButton, Arrow } from "@/components/ui/LinkButton";
import { Stat } from "@/components/ui/Stat";
import { CountUp } from "@/components/motion/CountUp";
import { FlowBar } from "@/components/charts/FlowBar";
import { PieChart, PieSlice, PieCenter } from "@/components/charts/PieChart";

function greeting(hour: number) {
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

export default async function DashboardPage() {
  const { user, household } = await requireSession();
  const month = currentMonth();
  const [overview, groceries, meetings, openItems] = await Promise.all([
    getHouseholdOverview(household.id, month),
    getGroceryMonth(household.id, month),
    getMeetings(household.id),
    getCarryOverItems(household.id),
  ]);

  const now = new Date();
  const monthName = format(now, "MMMM");
  const { shared, goals, people, household: flow } = overview;
  const [mainGoal, ...otherGoals] = goals;
  const pace = mainGoal ? savingsPace(mainGoal.saved, mainGoal.targetAmount, mainGoal.targetDate) : null;
  const latestMeeting = meetings[0];
  const sharedPlanned = shared.totalPlanned > 0;
  const sharedOver = sharedPlanned && shared.remaining < 0;
  const pieData = shared.categories.map((c) => ({ label: c.name, value: c.spent, color: c.color }));
  const personColors = [FLOW.spent, FLOW.partner];
  const nextPrep = groceries.mealPreps.find((p) => p.cookOn && p.cookOn >= format(now, "yyyy-MM-dd")) ?? groceries.mealPreps[0];

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`Overview · ${format(now, "EEEE d MMMM")}`} title={greeting(now.getHours())} accent={`${user.name}.`} />

      {/* The big shared goal */}
      {mainGoal ? (
        <Card className="overflow-hidden p-7 sm:p-10">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-mint/20 blur-3xl" />
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
              {pace && (
                <div className="mt-8 grid max-w-xl grid-cols-3 gap-4">
                  <Stat label="Days left">
                    <CountUp value={pace.daysLeft} format="number" />
                  </Stat>
                  <Stat label="Per month" tone="gold">
                    {formatCurrency(pace.perMonth)}
                  </Stat>
                  <Stat label="Per week" tone="gold">
                    {formatCurrency(pace.perWeek)}
                  </Stat>
                </div>
              )}
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
            Start with the goal you&apos;re working toward together — like R100 000 in joint savings by the end of the year.
          </p>
          <LinkButton href="/goals" size="lg" className="mt-8">
            Create your first goal <Arrow />
          </LinkButton>
        </Card>
      )}

      {/* Everything this month, both of you, shared and personal */}
      <Card className="p-7 sm:p-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold/80">{monthName}, together</p>
            <p className={`mt-3 font-display text-[clamp(2.75rem,7vw,4.5rem)] leading-[0.9] ${flow.left < 0 ? "text-coral" : "text-ivory"}`}>
              <CountUp value={Math.abs(flow.left)} />
            </p>
            <p className="mt-2 text-ivory/60">
              {flow.income === 0 ? "add your incomes to see what's left" : flow.left < 0 ? "more out than in" : "left over between you"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-10">
            <Stat label="Income">{formatCurrency(flow.income)}</Stat>
            <Stat label="Spent">{formatCurrency(flow.spent)}</Stat>
            <Stat label="Saved" tone="mint">
              {formatCurrency(flow.saved)}
            </Stat>
            <Stat label="Savings rate" tone="gold">
              {flow.savingsRate}%
            </Stat>
          </div>
        </div>
        <div className="mt-8">
          <FlowBar
            whole={flow.income || undefined}
            segments={[
              { key: "shared", label: "Shared spending", value: flow.sharedSpent, color: FLOW.shared },
              ...people.map((p, i) => ({
                key: p.id,
                label: `${p.id === user.id ? "Your" : `${p.name}'s`} spending`,
                value: p.spent,
                color: personColors[i % personColors.length],
              })),
              { key: "saved", label: "Saved", value: flow.saved, color: FLOW.saved },
              { key: "left", label: "Left over", value: Math.max(0, flow.left), color: FLOW.left },
            ]}
          />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* All savings, shared and personal */}
        <Card className="flex flex-col">
          <SectionTitle>Everything saved</SectionTitle>
          <p className="font-display text-5xl text-gradient-mint">
            <CountUp value={overview.totalSaved} />
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex justify-between gap-3">
              <Link href="/goals" className="text-ivory/65 hover:text-ivory">
                Shared goals
              </Link>
              <span className="font-semibold tabular">{formatCurrency(overview.goalsSaved)}</span>
            </li>
            {people.map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <Link href={`/personal/${p.id}/savings`} className="text-ivory/65 hover:text-ivory">
                  {p.id === user.id ? "Your" : `${p.name}'s`} accounts
                </Link>
                <span className="font-semibold tabular">{formatCurrency(p.savingsBalance)}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Each of you */}
        {people.map((p) => (
          <Link key={p.id} href={`/personal/${p.id}`} data-reveal className="group block min-w-0">
            <div className="glass relative h-full rounded-[28px] p-6 transition-transform duration-500 ease-out group-hover:-translate-y-1 sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-jade to-mint text-sm font-bold text-night">
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.id === user.id ? "You" : p.name}</p>
                  <p className="text-xs text-ivory/45">Personal · {monthName}</p>
                </div>
                <span className="ml-auto text-mint">
                  <Arrow />
                </span>
              </div>
              <p className={`font-display text-4xl ${p.left < 0 ? "text-coral" : "text-ivory"}`}>
                <CountUp value={Math.abs(p.left)} />
              </p>
              <p className="text-sm text-ivory/50">{p.income === 0 ? "no income logged yet" : p.left < 0 ? "overspent" : "left over"}</p>
              <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
                {[
                  ["In", p.income],
                  ["Spent", p.spent],
                  ["Saved", p.saved],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ivory/40">{label}</dt>
                    <dd className="mt-0.5 truncate font-semibold tabular">{formatCurrency(value as number)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Link>
        ))}

        {people.length < 2 && (
          <Card className="flex flex-col">
            <SectionTitle>Bring in your partner</SectionTitle>
            <p className="text-sm text-ivory/60">Share this join code so you both see the same numbers.</p>
            <p className="mt-4 font-display tabular text-gradient-gold text-5xl tracking-[0.12em]">{household.joinCode}</p>
            <Link href="/household" className="mt-auto pt-4 text-sm font-semibold text-gold hover:underline">
              Household settings
            </Link>
          </Card>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Shared spending */}
        <Card className="flex flex-col">
          <SectionTitle
            action={
              <Link href="/budget" className="text-sm font-semibold text-gold hover:underline">
                Budget
              </Link>
            }
          >
            Shared spending
          </SectionTitle>
          {sharedPlanned || shared.totalSpent > 0 ? (
            <div className="flex flex-1 items-center gap-6">
              <PieChart data={pieData} innerRadius={46} size={132}>
                {pieData.map((item, index) => (
                  <PieSlice index={index} key={item.label} />
                ))}
                <PieCenter defaultLabel="Spent" />
              </PieChart>
              <div className="min-w-0">
                {sharedPlanned ? (
                  <>
                    <p className={`text-3xl font-bold tracking-tight ${sharedOver ? "text-coral" : "text-ivory"}`}>
                      <CountUp value={Math.abs(shared.remaining)} />
                    </p>
                    <p className="text-sm text-ivory/55">{sharedOver ? "over budget" : "left to spend"}</p>
                    <p className="mt-2 text-xs text-ivory/40">
                      {formatCurrency(shared.totalSpent)} of {formatCurrency(shared.totalPlanned)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-bold tracking-tight">
                      <CountUp value={shared.totalSpent} />
                    </p>
                    <p className="text-sm text-ivory/55">spent, no budget set</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col justify-between gap-6">
              <p className="text-ivory/60">No shared budget or spending for {monthName} yet.</p>
              <LinkButton href="/budget" variant="secondary" className="self-start">
                Plan this month
              </LinkButton>
            </div>
          )}
        </Card>

        {/* Groceries */}
        <Card className="flex flex-col">
          <SectionTitle
            action={
              <Link href="/groceries" className="text-sm font-semibold text-gold hover:underline">
                List
              </Link>
            }
          >
            Groceries
          </SectionTitle>
          {groceries.totals.count > 0 ? (
            <div className="flex flex-1 flex-col justify-between gap-5">
              <div className="flex items-center gap-5">
                <ProgressRing
                  percent={Math.round((groceries.totals.boughtCount / groceries.totals.count) * 100)}
                  size={96}
                  stroke={8}
                  label="Share of the grocery list bought"
                >
                  <span className="text-sm font-bold tabular">
                    {groceries.totals.boughtCount}/{groceries.totals.count}
                  </span>
                </ProgressRing>
                <div className="min-w-0">
                  <p className="text-3xl font-bold tracking-tight">
                    <CountUp value={groceries.totals.planned} />
                  </p>
                  <p className="text-sm text-ivory/55">planned this month</p>
                </div>
              </div>
              {nextPrep && (
                <p className="text-sm text-ivory/60">
                  <span className="text-ivory/40">Next meal prep:</span> {nextPrep.name}
                  {nextPrep.cookOn && ` · ${formatDay(nextPrep.cookOn)}`}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col justify-between gap-6">
              <p className="text-ivory/60">No grocery list for {monthName} yet.</p>
              <LinkButton href="/groceries" variant="secondary" className="self-start">
                Start the list
              </LinkButton>
            </div>
          )}
        </Card>

        {/* Money Meeting */}
        <Card className="flex flex-col md:col-span-2 lg:col-span-1">
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
      </div>

      {otherGoals.length > 0 && (
        <Card>
          <SectionTitle
            action={
              <Link href="/goals" className="text-sm font-semibold text-gold hover:underline">
                Goals
              </Link>
            }
          >
            Other shared goals
          </SectionTitle>
          <ul className="grid gap-5 sm:grid-cols-2">
            {otherGoals.map((goal) => (
              <li key={goal.id}>
                <Link href={`/goals/${goal.id}`} className="block space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{goal.name}</span>
                    <span className="tabular text-ivory/50">
                      {formatCurrency(goal.saved)} · {goal.percent}%
                    </span>
                  </div>
                  <ProgressBar percent={goal.percent} size="sm" label={`${goal.name} progress`} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
