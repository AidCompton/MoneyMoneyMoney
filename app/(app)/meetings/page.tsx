import Link from "next/link";
import { format, parseISO } from "date-fns";
import { requireSession } from "@/lib/auth";
import { getMeetings, getCarryOverItems } from "@/lib/data";
import { Card } from "@/components/ui/Card";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { Arrow } from "@/components/ui/LinkButton";
import { NewMeetingForm } from "@/components/meetings/NewMeetingForm";

export default async function MeetingsPage() {
  const { household } = await requireSession();
  const [meetings, openItems] = await Promise.all([
    getMeetings(household.id),
    getCarryOverItems(household.id),
  ]);

  const openByMeeting = new Map<string, number>();
  for (const item of openItems) {
    openByMeeting.set(item.meetingId, (openByMeeting.get(item.meetingId) ?? 0) + 1);
  }

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Money Meetings" title="Every week," accent="on purpose." />

      <Card className="max-w-2xl">
        <SectionTitle>New meeting</SectionTitle>
        <p className="mb-6 text-sm text-ivory/55">
          Each meeting shows where your goals and grocery budget stand right now, with space for
          notes and action items. Anything left undone can be carried into the next one.
        </p>
        <NewMeetingForm />
      </Card>

      {meetings.length === 0 ? (
        <p data-reveal className="text-ivory/50">No meetings logged yet.</p>
      ) : (
        <ol className="space-y-3">
          {meetings.map((m, i) => {
            const date = parseISO(m.date);
            const open = openByMeeting.get(m.id) ?? 0;
            return (
              <li key={m.id} data-reveal>
                <Link
                  href={`/meetings/${m.id}`}
                  className="glass group flex items-center gap-6 rounded-[24px] p-4 pr-6 transition-colors duration-300 hover:bg-white/[0.08] sm:p-5 sm:pr-8"
                >
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/[0.05] text-center ring-1 ring-white/10">
                    <div>
                      <p className="font-display text-2xl leading-none">{format(date, "d")}</p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ivory/50">
                        {format(date, "MMM")}
                      </p>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold tracking-tight">
                      {format(date, "EEEE, d MMMM yyyy")}
                      {i === 0 && (
                        <span className="ml-3 rounded-full bg-mint/15 px-2.5 py-0.5 align-middle text-xs font-semibold text-mint">
                          Latest
                        </span>
                      )}
                    </p>
                    <p className="truncate text-sm text-ivory/50">
                      {m.notes ? m.notes.split("\n")[0] : "No notes yet"}
                    </p>
                  </div>
                  {open > 0 && (
                    <span className="hidden rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold sm:inline">
                      {open} open
                    </span>
                  )}
                  <span className="text-gold">
                    <Arrow />
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
