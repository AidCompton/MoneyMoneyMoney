import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { Logo } from "@/components/shell/Logo";
import { Ticker } from "@/components/motion/Ticker";
import { PageReveal } from "@/components/motion/PageReveal";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  // Check the session still points at a real user, not just that the cookie
  // is set - otherwise a stale cookie (e.g. after the account was removed)
  // would bounce you straight back here from /dashboard, forever.
  if (session.userId && (await db.query.users.findFirst({ where: eq(users.id, session.userId) }))) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 pt-6 sm:px-10 sm:pt-8">
        <Logo href="/login" />
      </header>
      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-12 sm:px-10 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
        {/* The page itself animates via template.tsx; this reveals the hero,
            which lives in the layout and so sits outside the template. */}
        <PageReveal>
          <p data-reveal className="mb-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-mint/80">
            <span className="h-px w-8 bg-mint/60" />
            Your household money, together
          </p>
          <h1 data-split className="font-display text-[clamp(3.25rem,9vw,7.5rem)]">
            Grow what <span className="font-accent text-gradient-gold pr-2">matters.</span>
          </h1>
          <p data-reveal className="mt-8 max-w-md text-lg leading-relaxed text-ivory/60">
            Savings goals, the monthly grocery budget, and your weekly Money Meeting — in one calm
            place that runs on your own computer.
          </p>
        </PageReveal>
        <section className="w-full max-w-md justify-self-center lg:justify-self-end">{children}</section>
      </div>
      <div className="border-t border-white/[0.06] py-6 font-display text-[clamp(1.5rem,3vw,2.25rem)] text-ivory/25">
        <Ticker items={["Save with intention", "Plan every week", "Grow together", "R100 000 by December", "Spend on purpose"]} />
      </div>
    </div>
  );
}
