import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import {
  getMeetingWithItems,
  getGoalsWithProgress,
  getBudgetWithExpenses,
  getHouseholdMembers,
  getCarryOverItems,
  currentMonth,
} from "@/lib/data";
import { budgetPercentSpent } from "@/lib/calculations";
import { toggleActionItem, carryOverItem, deleteActionItem, deleteMeeting } from "@/lib/actions/meetings";
import { formatCurrency } from "@/lib/currency";
import { formatDay, formatLongDay } from "@/lib/dates";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { NotesEditor } from "@/components/meetings/NotesEditor";
import { AddActionItemForm } from "@/components/meetings/AddActionItemForm";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { household } = await requireSession();
  const result = await getMeetingWithItems(id);

  if (!result || result.meeting.householdId !== household.id) {
    notFound();
  }

  const { meeting, items } = result;

  const [goals, { budget, spent, remaining }, members, carryOver] = await Promise.all([
    getGoalsWithProgress(household.id),
    getBudgetWithExpenses(household.id, currentMonth()),
    getHouseholdMembers(household.id),
    getCarryOverItems(household.id, meeting.id),
  ]);

  const doneCount = items.filter((i) => i.done).length;
  const over = remaining < 0;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`Money Meeting · ${formatLongDay(meeting.date)}`} title="This week's" accent="check-in.">
        <Link href="/meetings" className="text-sm font-semibold text-gold hover:underline">
          ← All meetings
        </Link>
      </PageHeader>

      {/* Live snapshot to talk through */}
      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <SectionTitle
            action={
              <Link href="/goals" className="text-sm font-semibold text-gold hover:underline">
                Goals
              </Link>
            }
          >
            Savings goals
          </SectionTitle>
          {goals.length === 0 ? (
            <p className="text-ivory/55">No goals yet.</p>
          ) : (
            <div className="space-y-5">
              {goals.map((g) => (
                <div key={g.id} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-semibold">{g.name}</span>
                    <span className="shrink-0 tabular text-ivory/55">
                      {formatCurrency(g.saved)} · {g.percent}%
                    </span>
                  </div>
                  <ProgressBar percent={g.percent} size="sm" label={`${g.name} progress`} />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <SectionTitle
            action={
              <Link href="/budget" className="text-sm font-semibold text-gold hover:underline">
                Budget
              </Link>
            }
          >
            This month&apos;s groceries
          </SectionTitle>
          {budget ? (
            <div className="space-y-3">
              <p className={`font-display text-4xl ${over ? "text-coral" : "text-ivory"}`}>
                {formatCurrency(Math.abs(remaining))}{" "}
                <span className="font-sans text-base font-medium tracking-normal text-ivory/55">
                  {over ? "over" : "left"}
                </span>
              </p>
              <ProgressBar
                percent={budgetPercentSpent(budget.budgetedAmount, spent)}
                size="sm"
                tone={over ? "over" : "spend"}
                label="Grocery budget spent"
              />
              <p className="text-sm text-ivory/50">
                {formatCurrency(spent)} spent of {formatCurrency(budget.budgetedAmount)}
              </p>
            </div>
          ) : (
            <p className="text-ivory/55">No budget set for this month.</p>
          )}
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <SectionTitle>Notes</SectionTitle>
          <NotesEditor meetingId={meeting.id} notes={meeting.notes} />
        </Card>

        <Card className="lg:col-span-3">
          <SectionTitle
            action={
              items.length > 0 && (
                <span className="text-sm tabular text-ivory/50">
                  {doneCount}/{items.length} done
                </span>
              )
            }
          >
            Action items
          </SectionTitle>
          {items.length === 0 ? (
            <p className="mb-6 text-ivory/55">No action items yet.</p>
          ) : (
            <ul className="mb-8 space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`row-enter flex items-center gap-4 rounded-2xl p-3 transition-colors duration-500 ${
                    item.done ? "bg-mint/[0.05]" : "bg-white/[0.035]"
                  }`}
                >
                  <form action={toggleActionItem.bind(null, item.id, meeting.id)}>
                    <button
                      type="submit"
                      aria-label={item.done ? "Mark as not done" : "Mark as done"}
                      className={`grid h-7 w-7 place-items-center rounded-full border-2 transition-all duration-300 ${
                        item.done
                          ? "border-mint bg-mint text-night shadow-[0_0_16px_rgb(79_227_165/0.6)]"
                          : "border-ivory/25 hover:scale-110 hover:border-mint"
                      }`}
                    >
                      {item.done && (
                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
                          <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  </form>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`transition-colors duration-500 ${
                        item.done ? "text-ivory/40 line-through decoration-mint/60" : "text-ivory"
                      }`}
                    >
                      {item.description}
                    </p>
                    <p className="text-xs text-ivory/40">
                      {item.assignee ? item.assignee.name : "Either of you"}
                      {item.dueDate && ` · due ${formatDay(item.dueDate)}`}
                    </p>
                  </div>
                  <form action={deleteActionItem.bind(null, item.id, meeting.id)}>
                    <ConfirmButton icon label="Delete action item" />
                  </form>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-white/[0.07] pt-6">
            <AddActionItemForm meetingId={meeting.id} members={members} />
          </div>
        </Card>
      </div>

      {carryOver.length > 0 && (
        <Card className="border-gold/20">
          <SectionTitle>Still open from earlier meetings</SectionTitle>
          <ul className="space-y-2">
            {carryOver.map((item) => (
              <li key={item.id} className="row-enter flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.035] p-3 pl-4">
                <div className="min-w-0">
                  <p>{item.description}</p>
                  <p className="text-xs text-ivory/40">From {formatDay(item.meetingDate)}</p>
                </div>
                <form action={carryOverItem.bind(null, item.id, meeting.id)}>
                  <Button type="submit" variant="secondary" size="sm">
                    Add to this meeting
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div data-reveal className="flex justify-end">
        <form action={deleteMeeting.bind(null, meeting.id)}>
          <ConfirmButton label="Delete this meeting" confirmLabel="Delete meeting and its action items?" />
        </form>
      </div>
    </div>
  );
}
