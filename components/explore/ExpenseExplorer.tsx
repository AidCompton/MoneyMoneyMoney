import Link from "next/link";
import type { Spending } from "@/lib/data";
import { formatCurrency } from "@/lib/currency";
import { formatDay } from "@/lib/dates";
import { NONE, type FacetOption } from "@/lib/facets";
import { withParams } from "@/lib/urls";
import { deleteExpense } from "@/lib/actions/budget";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/PageHeader";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { FacetBars, type FacetBar } from "./FacetBars";

const LABELS: Record<string, string> = {
  cat: "Category",
  sub: "Sub-category",
  store: "Store",
  who: "Added by",
};

/**
 * The month's expenses, cross-filtered by category, sub-category, store and
 * (for shared money) who added them. Filters live in the URL, so a filtered
 * view can be bookmarked or opened on the other phone.
 */
export function ExpenseExplorer({
  spending,
  basePath,
  month,
  canEdit,
}: {
  spending: Spending;
  basePath: string;
  month: string;
  canEdit: boolean;
}) {
  const active = spending.activeFilters;
  const params = { month, ...active };
  const toggle = (key: string, value: string) =>
    withParams(basePath, { ...params, [key]: active[key] === value ? undefined : value });
  const bars = (key: string): FacetBar[] =>
    (spending.facets[key] ?? []).map((o: FacetOption) => ({
      ...o,
      label: o.value === NONE ? `No ${LABELS[key].toLowerCase()}` : o.label,
      href: toggle(key, o.value),
      active: active[key] === o.value,
    }));
  const activeEntries = Object.entries(active).filter(([, v]) => v);
  const labelFor = (key: string, value: string) =>
    value === NONE
      ? `No ${LABELS[key].toLowerCase()}`
      : (spending.facets[key]?.find((o) => o.value === value)?.label ?? "Unknown");

  return (
    <Card id="explore">
      <SectionTitle
        action={
          activeEntries.length > 0 && (
            <Link href={withParams(basePath, { month })} scroll={false} className="text-sm font-semibold text-gold hover:underline">
              Clear filters
            </Link>
          )
        }
      >
        Where it went
      </SectionTitle>

      {spending.expenseCount === 0 ? (
        <p className="text-ivory/55">Nothing spent yet this month.</p>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ivory/55">
              {activeEntries.length ? "Showing" : "All"}{" "}
              <span className="font-semibold tabular text-ivory">{formatCurrency(spending.filteredTotal)}</span> across{" "}
              {spending.expenses.length} expense{spending.expenses.length === 1 ? "" : "s"}
              {activeEntries.length > 0 && " for"}
            </span>
            {activeEntries.map(([key, value]) => (
              <Link
                key={key}
                href={toggle(key, value!)}
                scroll={false}
                className="row-enter inline-flex items-center gap-2 rounded-full bg-gold/15 py-1 pl-3 pr-2 text-xs font-semibold text-gold ring-1 ring-inset ring-gold/30 hover:bg-gold/25"
                aria-label={`Remove filter ${LABELS[key]}: ${labelFor(key, value!)}`}
              >
                <span className="text-ivory/50">{LABELS[key]}</span> {labelFor(key, value!)}
                <span aria-hidden className="grid h-4 w-4 place-items-center rounded-full bg-gold/20">
                  ×
                </span>
              </Link>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <FacetBars title="Category" bars={bars("cat")} empty="—" />
            <FacetBars title="Sub-category" bars={bars("sub")} empty="None yet" />
            <FacetBars title="Store" bars={bars("store")} empty="None yet" />
          </div>

          {spending.facets.who && spending.facets.who.length > 1 && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ivory/45">Added by</span>
              {bars("who").map((b) => (
                <Link
                  key={b.value}
                  href={b.href}
                  scroll={false}
                  aria-pressed={b.active}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    b.active ? "bg-gold/15 text-gold ring-1 ring-inset ring-gold/40" : "bg-white/[0.05] text-ivory/70 hover:text-ivory"
                  }`}
                >
                  {b.label} · {formatCurrency(b.total)}
                </Link>
              ))}
            </div>
          )}

          <ul className="mt-8 divide-y divide-white/[0.07] border-t border-white/[0.07]">
            {spending.expenses.length === 0 && (
              <li className="py-6 text-center text-sm text-ivory/50">Nothing matches those filters.</li>
            )}
            {spending.expenses.map((e) => (
              <li key={e.id} className="row-enter flex items-center gap-4 py-3.5">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.description}</p>
                  <p className="truncate text-sm text-ivory/45">
                    {e.categoryName}
                    {e.subcategoryName && ` › ${e.subcategoryName}`}
                    {e.storeName && ` · ${e.storeName}`} · {formatDay(e.date)}
                    {spending.scope === "shared" && ` · ${e.userName}`}
                  </p>
                </div>
                {e.receiptId && (
                  <Link
                    href={`/receipts/${e.receiptId}`}
                    aria-label="View receipt"
                    title="View receipt"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ivory/40 transition-colors hover:bg-white/[0.07] hover:text-gold"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                      <path d="M5 2.5h10v15l-2-1.2-1.7 1.2-1.6-1.2-1.7 1.2L6.3 16.3 5 17.5z" strokeLinejoin="round" />
                      <path d="M7.5 6.5h5M7.5 9.5h5M7.5 12.5h3" strokeLinecap="round" />
                    </svg>
                  </Link>
                )}
                <span className="font-semibold tabular">{formatCurrency(e.amount)}</span>
                {canEdit && (
                  <form action={deleteExpense.bind(null, e.id)}>
                    <ConfirmButton icon label="Delete expense" />
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
