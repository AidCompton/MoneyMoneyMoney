import Link from "next/link";
import type { getSavingsActivity } from "@/lib/data";
import { formatCurrency } from "@/lib/currency";
import { formatDay } from "@/lib/dates";
import { NONE } from "@/lib/facets";
import { withParams } from "@/lib/urls";
import { deleteSavingsTransaction } from "@/lib/actions/savings";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/PageHeader";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { FacetBars, type FacetBar } from "@/components/explore/FacetBars";

type Activity = Awaited<ReturnType<typeof getSavingsActivity>>;

const LABELS: Record<string, string> = { account: "Account", tag: "Sub-category", dir: "Direction" };

/** A month's deposits and withdrawals, cross-filtered by account, sub-category and direction. */
export function SavingsActivity({
  activity,
  basePath,
  month,
  canEdit,
}: {
  activity: Activity;
  basePath: string;
  month: string;
  canEdit: boolean;
}) {
  const active = activity.activeFilters;
  const params = { month, ...active };
  const toggle = (key: string, value: string) =>
    withParams(basePath, { ...params, [key]: active[key] === value ? undefined : value });
  const bars = (key: string): FacetBar[] =>
    (activity.facets[key] ?? []).map((o) => ({
      ...o,
      label: o.value === NONE ? `No ${LABELS[key].toLowerCase()}` : o.label,
      href: toggle(key, o.value),
      active: active[key] === o.value,
    }));
  const filtered = Object.values(active).some(Boolean);

  return (
    <Card>
      <SectionTitle
        action={
          filtered && (
            <Link href={withParams(basePath, { month })} scroll={false} className="text-sm font-semibold text-mint hover:underline">
              Clear filters
            </Link>
          )
        }
      >
        This month&apos;s activity
      </SectionTitle>
      {activity.count === 0 ? (
        <p className="text-ivory/55">No deposits or withdrawals this month.</p>
      ) : (
        <>
          <p className="mb-6 text-sm text-ivory/55">
            Net{" "}
            <span className={`font-semibold tabular ${activity.net < 0 ? "text-coral" : "text-mint"}`}>
              {activity.net < 0 ? "−" : "+"}
              {formatCurrency(Math.abs(activity.net))}
            </span>{" "}
            across {activity.transactions.length} entr{activity.transactions.length === 1 ? "y" : "ies"}
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            <FacetBars title="Account" bars={bars("account")} empty="—" />
            <FacetBars title="Sub-category" bars={bars("tag")} empty="None yet" />
            <FacetBars title="Direction" bars={bars("dir")} empty="—" />
          </div>
          <ul className="mt-8 divide-y divide-white/[0.07] border-t border-white/[0.07]">
            {activity.transactions.length === 0 && (
              <li className="py-6 text-center text-sm text-ivory/50">Nothing matches those filters.</li>
            )}
            {activity.transactions.map((t) => (
              <li key={t.id} className="row-enter flex items-center gap-4 py-3.5">
                <span
                  aria-hidden
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold ${
                    t.amount < 0 ? "bg-coral/10 text-coral" : "bg-mint/10 text-mint"
                  }`}
                >
                  {t.amount < 0 ? "↓" : "↑"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.tagName ?? (t.amount < 0 ? "Withdrawal" : "Deposit")}</p>
                  <p className="truncate text-sm text-ivory/45">
                    {t.accountName} · {formatDay(t.date)}
                    {t.note && ` · ${t.note}`}
                  </p>
                </div>
                <span className={`font-semibold tabular ${t.amount < 0 ? "text-coral" : "text-mint"}`}>
                  {t.amount < 0 ? "−" : "+"}
                  {formatCurrency(Math.abs(t.amount))}
                </span>
                {canEdit && (
                  <form action={deleteSavingsTransaction.bind(null, t.id)}>
                    <ConfirmButton icon label="Delete entry" />
                  </form>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
