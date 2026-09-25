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
import { toggleActionItem, carryOverItem } from "@/lib/actions/meetings";
import { formatCurrency } from "@/lib/currency";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
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

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">
        Money Meeting ·{" "}
        {new Date(meeting.date).toLocaleDateString("en-ZA", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </h1>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-medium text-slate-500">Savings goals</h2>
          {goals.length === 0 ? (
            <p className="text-sm text-slate-500">No goals yet.</p>
          ) : (
            <div className="space-y-3">
              {goals.map((g) => (
                <div key={g.id}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-800">{g.name}</span>
                    <span className="text-slate-500">{g.percent}%</span>
                  </div>
                  <ProgressBar percent={g.percent} />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-medium text-slate-500">This month&apos;s groceries</h2>
          {budget ? (
            <p className="text-sm text-slate-700">
              {formatCurrency(spent)} spent of {formatCurrency(budget.budgetedAmount)} —{" "}
              <span className={remaining < 0 ? "font-medium text-red-600" : "font-medium"}>
                {remaining < 0
                  ? `${formatCurrency(Math.abs(remaining))} over`
                  : `${formatCurrency(remaining)} left`}
              </span>
            </p>
          ) : (
            <p className="text-sm text-slate-500">No budget set for this month.</p>
          )}
        </Card>
      </section>

      <Card>
        <h2 className="mb-4 text-lg font-medium text-slate-800">Notes</h2>
        <NotesEditor meetingId={meeting.id} notes={meeting.notes} />
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-medium text-slate-800">Action items</h2>
        {items.length === 0 ? (
          <p className="mb-4 text-sm text-slate-500">No action items yet.</p>
        ) : (
          <ul className="mb-4 divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-2 text-sm">
                <form action={toggleActionItem.bind(null, item.id, meeting.id)}>
                  <button
                    type="submit"
                    aria-label={item.done ? "Mark as not done" : "Mark as done"}
                    className={`flex h-5 w-5 items-center justify-center rounded border ${
                      item.done
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-slate-300"
                    }`}
                  >
                    {item.done ? "✓" : ""}
                  </button>
                </form>
                <div className="flex-1">
                  <p className={item.done ? "text-slate-400 line-through" : "text-slate-800"}>
                    {item.description}
                  </p>
                  <p className="text-xs text-slate-400">
                    {item.assignee ? item.assignee.name : "Either of you"}
                    {item.dueDate &&
                      ` · due ${new Date(item.dueDate).toLocaleDateString("en-ZA")}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <AddActionItemForm meetingId={meeting.id} members={members} />
      </Card>

      {carryOver.length > 0 && (
        <Card>
          <h2 className="mb-4 text-lg font-medium text-slate-800">
            Carried over from previous meetings
          </h2>
          <ul className="divide-y divide-slate-100">
            {carryOver.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <p className="text-slate-800">{item.description}</p>
                  <p className="text-xs text-slate-400">
                    From {new Date(item.meetingDate).toLocaleDateString("en-ZA")}
                  </p>
                </div>
                <form action={carryOverItem.bind(null, item.id, meeting.id)}>
                  <Button type="submit" variant="secondary" className="text-xs">
                    Add to this meeting
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
