import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { CreateHouseholdForm, JoinHouseholdForm } from "@/components/auth/RegisterForms";

type Search = { join?: string; code?: string };

// The tabs are links (/register and /register?join), not client state, so
// joining works even when the page's scripts haven't loaded, say on a phone
// with a weak Wi-Fi signal. A join link (/register?code=AB12CD) opens the
// join form with the code already filled in.
function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      replace
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={`flex flex-1 items-center justify-center rounded-full px-3 py-2.5 text-center text-sm leading-tight font-semibold transition-all duration-500 ${
        active
          ? "bg-gradient-to-r from-gold to-sunrise text-night shadow-[0_6px_20px_-6px_rgb(247_195_92/0.8)]"
          : "text-ivory/60 hover:text-ivory"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const code = params.code?.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 12) || undefined;
  const joining = params.join !== undefined || !!code;

  return (
    <Card className="p-8 sm:p-10">
      <h2 className="text-2xl font-semibold tracking-tight">Get started</h2>
      <p className="mt-1 mb-6 text-sm text-ivory/55">
        One of you creates the household; the other joins with its code.
      </p>
      <nav aria-label="Sign-up options" className="mb-8 flex rounded-full bg-white/[0.05] p-1 ring-1 ring-inset ring-white/10">
        <Tab href="/register" active={!joining}>
          New household
        </Tab>
        <Tab href={code ? `/register?code=${code}` : "/register?join"} active={joining}>
          Join a household
        </Tab>
      </nav>
      {joining ? <JoinHouseholdForm code={code} /> : <CreateHouseholdForm />}
      <p className="mt-6 text-center text-sm text-ivory/55">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-gold hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
