import { requireSession } from "@/lib/auth";
import { getHouseholdMembers } from "@/lib/data";
import { Card } from "@/components/ui/Card";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { CopyButton } from "@/components/ui/CopyButton";

export default async function HouseholdPage() {
  const { household, user } = await requireSession();
  const members = await getHouseholdMembers(household.id);

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Household" title={`${household.name},`} accent="together." />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <SectionTitle>Invite your partner</SectionTitle>
          <p className="max-w-md text-ivory/60">
            Share this code. They choose <span className="text-ivory">Join a household</span> on
            the sign-up page and enter it to see the same goals, budget, and meetings.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <p
              aria-label="Join code"
              className="font-display tabular text-gradient-gold text-[clamp(3rem,9vw,5.5rem)] tracking-[0.12em]"
            >
              {household.joinCode}
            </p>
            <CopyButton text={household.joinCode} label="Copy code" />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle>Members</SectionTitle>
          <ul className="space-y-3">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-4 rounded-2xl bg-white/[0.03] p-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-jade to-gold text-base font-bold text-night">
                  {m.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {m.name}
                    {m.id === user.id && <span className="ml-2 text-xs font-medium text-mint">you</span>}
                  </p>
                  <p className="truncate text-sm text-ivory/50">{m.email}</p>
                </div>
              </li>
            ))}
          </ul>
          {members.length < 2 && (
            <p className="mt-4 text-sm text-ivory/45">Waiting for your partner to join.</p>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle>Your data</SectionTitle>
        <p className="max-w-2xl text-ivory/60">
          Everything is stored in one file, <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm text-ivory">data/app.db</code>,
          on the computer running this app. Nothing is sent anywhere. Back it up now and then by
          running <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm text-ivory">npm run db:backup</code>.
        </p>
      </Card>
    </div>
  );
}
