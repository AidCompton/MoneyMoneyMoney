import QRCode from "qrcode";
import { maxHouseholdMembers, requireSession } from "@/lib/auth";
import { getHouseholdMembers } from "@/lib/data";
import { siteOrigin } from "@/lib/site";
import { Card } from "@/components/ui/Card";
import { PageHeader, SectionTitle } from "@/components/ui/PageHeader";
import { CopyButton } from "@/components/ui/CopyButton";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { AccountSecurity } from "@/components/household/AccountSecurity";

const qr = (text: string) => QRCode.toString(text, { type: "svg", margin: 1, color: { dark: "#06110dff", light: "#f4efe3ff" } });

export default async function HouseholdPage() {
  const { household, user } = await requireSession();
  const [members, origin] = await Promise.all([getHouseholdMembers(household.id), siteOrigin()]);
  const hasRoom = members.length < maxHouseholdMembers();
  const joinLink = `${origin}/register?code=${household.joinCode}`;
  const appLink = `${origin}/dashboard`;
  const [joinQr, appQr] = await Promise.all([hasRoom ? qr(joinLink) : "", qr(appLink)]);

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Household" title={`${household.name},`} accent="together." />

      <div className="grid gap-6 lg:grid-cols-5">
        {hasRoom && (
          <Card className="lg:col-span-3">
            <SectionTitle>Invite your partner</SectionTitle>
            <p className="max-w-md text-ivory/60">
              Share this code. They choose <span className="text-ivory">Join a household</span> on the sign-up page and
              enter it to see the same goals, budget, and meetings. Or send them the link below, which opens that page
              with the code filled in.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <p
                aria-label="Join code"
                className="font-display tabular text-gradient-gold text-[clamp(2.5rem,8vw,5rem)] tracking-[0.12em]"
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
                <p className="text-sm text-ivory/55">On their phone, scan this with the Camera or open:</p>
                <p aria-label="Join link" className="break-all text-sm font-semibold text-ivory">
                  {joinLink}
                </p>
                <CopyButton text={joinLink} label="Copy link" />
              </div>
            </div>
          </Card>
        )}

        <Card className={hasRoom ? "lg:col-span-2" : "lg:col-span-5"}>
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
          {hasRoom ? (
            <p className="mt-4 text-sm text-ivory/45">Waiting for your partner to join.</p>
          ) : (
            <p className="mt-4 text-sm text-ivory/45">
              Your household is full, so nobody else can join with its code.
            </p>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle>Use it on your phones</SectionTitle>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div
            role="img"
            aria-label={`QR code for ${appLink}`}
            className="h-40 w-40 shrink-0 overflow-hidden rounded-2xl bg-ivory p-2 [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: appQr }}
          />
          <div className="min-w-0 space-y-3 text-sm text-ivory/65">
            <p>
              On each iPhone, point the Camera at the code (or type{" "}
              <span className="break-all font-semibold text-ivory">{origin}</span> into Safari) and sign in.
            </p>
            <p>
              Then tap <span className="font-semibold text-ivory">Share → Add to Home Screen</span>. It opens full screen
              like any other app, wherever you are.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Your account</SectionTitle>
        <AccountSecurity />
      </Card>

      <Card>
        <SectionTitle>Your data</SectionTitle>
        <p className="mb-6 max-w-2xl text-ivory/60">
          Download everything your household has stored, as a file you can keep somewhere safe or move elsewhere.
          Passwords are never included.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="/api/export" className={buttonClasses({ variant: "secondary" })}>
            Download everything
          </a>
          <a href="/api/export?images=1" className={buttonClasses({ variant: "ghost" })}>
            With receipt photos (larger)
          </a>
        </div>
      </Card>
    </div>
  );
}
