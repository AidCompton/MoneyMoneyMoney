import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { logout } from "@/lib/actions/auth";
import { SubmitButton } from "@/components/ui/SubmitButton";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/goals", label: "Goals" },
  { href: "/budget", label: "Budget" },
  { href: "/meetings", label: "Money Meetings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, household } = await requireSession();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-sm text-slate-500">{household.name}</p>
            <p className="text-xs text-slate-400">Signed in as {user.name}</p>
          </div>
          <nav className="flex flex-wrap gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <form action={logout}>
            <SubmitButton variant="secondary" pendingText="Signing out…">
              Sign out
            </SubmitButton>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
