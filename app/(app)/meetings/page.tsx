import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getMeetings } from "@/lib/data";
import { Card } from "@/components/ui/Card";
import { NewMeetingForm } from "@/components/meetings/NewMeetingForm";

export default async function MeetingsPage() {
  const { household } = await requireSession();
  const meetings = await getMeetings(household.id);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">Money Meetings</h1>

      <Card className="max-w-lg">
        <NewMeetingForm />
      </Card>

      <div className="space-y-2">
        {meetings.length === 0 ? (
          <p className="text-sm text-slate-500">No meetings logged yet.</p>
        ) : (
          meetings.map((m) => (
            <Link key={m.id} href={`/meetings/${m.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <p className="font-medium text-slate-900">
                  {new Date(m.date).toLocaleDateString("en-ZA", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
