import { requireSession } from "@/lib/auth";
import { logout } from "@/lib/actions/auth";
import { getHouseholdMembers } from "@/lib/data";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { MainNav } from "@/components/shell/MainNav";
import { SubNav } from "@/components/shell/SubNav";
import { Logo } from "@/components/shell/Logo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, household } = await requireSession();
  const members = (await getHouseholdMembers(household.id)).map((m) => ({ id: m.id, name: m.name }));

  return (
    <>
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-5">
        <div className="glass-strong mx-auto flex max-w-6xl items-center gap-3 rounded-full py-2 pl-3 pr-2 sm:gap-4 sm:pl-4">
          <Logo />
          <div className="mx-auto hidden min-w-0 md:block">
            <MainNav userId={user.id} />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
            <span
              className="hidden h-9 w-9 place-items-center rounded-full bg-white/10 text-sm font-bold text-gold ring-1 ring-white/15 lg:grid"
              title={`Signed in as ${user.name}`}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <form action={logout}>
              <SubmitButton variant="ghost" size="sm" pendingText="…" magnetic={false}>
                Sign out
              </SubmitButton>
            </form>
          </div>
        </div>
      </header>
      <SubNav members={members} userId={user.id} />
      {/* On phones the spaces move to a thumb-reachable bar at the bottom. */}
      <div className="glass-strong fixed inset-x-3 bottom-3 z-40 rounded-full md:hidden">
        <MainNav userId={user.id} compact />
      </div>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-8 sm:px-6 sm:pt-12">{children}</main>
      <footer className="overflow-hidden px-4 pb-8 sm:px-6">
        <div className="mx-auto max-w-6xl border-t border-white/10 pt-8">
          <p className="font-display select-none text-[clamp(2.5rem,10.5vw,9.5rem)] leading-none text-white/[0.04]">
            Money<span className="font-accent">Money</span>Money
          </p>
          <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs text-ivory/40">
            <span>Runs on your own machine. Your numbers never leave home.</span>
            <span>Signed in as {user.name}</span>
          </div>
        </div>
      </footer>
    </>
  );
}
