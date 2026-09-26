import { requireSession } from "@/lib/auth";
import { getHouseholdMembers } from "@/lib/data";
import { Card } from "@/components/ui/Card";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { CopyButton } from "@/components/ui/CopyButton";
import { headers } from "next/headers";
import { BackupPanel } from "@/components/household/BackupPanel";
import QRCode from "qrcode";
import { PhoneSetup } from "@/components/household/PhoneSetup";
import { lanAddresses } from "@/lib/network";
import { listBackups } from "@/lib/backup";

export default async function HouseholdPage() {
  const { household, user } = await requireSession();
  const members = await getHouseholdMembers(household.id);
  const host = (await headers()).get("host") ?? "";
  const port = host.split(":")[1] ?? "3000";
  const lan = lanAddresses(port);
  // The link has to work from your partner's phone, so prefer this
  // computer's home-network address over "localhost".
  const joinLink = `${lan.urls[0] ?? `http://${host}`}/register?code=${household.joinCode}`;
  const joinQr = await QRCode.toString(joinLink, {
    type: "svg",
    margin: 1,
    color: { dark: "#06110dff", light: "#f4efe3ff" },
  });

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Household" title={`${household.name},`} accent="together." />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <SectionTitle>Invite your partner</SectionTitle>
          <p className="max-w-md text-ivory/60">
            Share this code. They choose <span className="text-ivory">Join a household</span> on
            the sign-up page and enter it to see the same goals, budget, and meetings. Or send them the link below,
            which opens that page with the code filled in.
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
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div
              role="img"
              aria-label="QR code for the join link"
              className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-ivory p-1.5 [&>svg]:h-full [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: joinQr }}
            />
            <div className="min-w-0 space-y-3">
              <p className="text-sm text-ivory/55">
                On their phone, on your home Wi-Fi, scan this with the Camera or open:
              </p>
              <p aria-label="Join link" className="break-all text-sm font-semibold text-ivory">
                {joinLink}
              </p>
              <CopyButton text={joinLink} label="Copy link" />
            </div>
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
        <SectionTitle>Use it on your phones</SectionTitle>
        <PhoneSetup {...lan} />
      </Card>

      <Card>
        <SectionTitle>Your data</SectionTitle>
        <p className="mb-6 max-w-2xl text-ivory/60">
          Everything lives in one file on the computer running this app, and nothing is sent anywhere. Back it up now
          and then, and download a copy to keep somewhere else (a backup on the same computer won&apos;t help if that
          computer is lost).
        </p>
        <BackupPanel backups={listBackups()} />
      </Card>
    </div>
  );
}
