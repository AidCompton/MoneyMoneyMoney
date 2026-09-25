"use client";

import { useState } from "react";
import { PieChart, PieSlice, PieCenter, type PieDatum } from "@/components/charts/PieChart";
import { formatCurrency } from "@/lib/currency";
import { foldSlices } from "@/lib/calculations";
import { OTHER_COLOR } from "@/lib/categories";

type Category = { name: string; color: string; planned: number; spent: number };

/**
 * The month's spending as a donut plus a table of every category. Hovering
 * a slice highlights its row and vice versa; the table doubles as the
 * chart's accessible, exact-number view.
 */
export function SpendingBreakdown({
  categories,
  size = 240,
  innerRadius = 84,
  compact = false,
}: {
  categories: Category[];
  size?: number;
  innerRadius?: number;
  compact?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  // Past eight categories the smallest share one "Other" slice; the table
  // below still lists every category.
  const pieData: PieDatum[] = foldSlices(
    categories.map((c) => ({ label: c.name, value: c.spent, color: c.color })),
    8,
    (rest) => ({ label: "Other", value: rest.reduce((sum, r) => sum + r.value, 0), color: OTHER_COLOR }),
  );
  const sliceIndex = (name: string) => pieData.findIndex((d) => d.label === name);
  const total = categories.reduce((sum, c) => sum + c.spent, 0);
  const rows = compact ? categories.map((c, i) => ({ ...c, i })).filter((c) => c.spent > 0) : categories.map((c, i) => ({ ...c, i }));

  return (
    <div className={`flex flex-col items-center gap-8 ${compact ? "sm:flex-row sm:items-center" : "lg:flex-row lg:items-center lg:justify-center lg:gap-16"}`}>
      <PieChart data={pieData} innerRadius={innerRadius} size={size} active={active} onActiveChange={setActive}>
        {pieData.map((item, index) => (
          <PieSlice index={index} key={item.label} />
        ))}
        <PieCenter defaultLabel="Total" />
      </PieChart>

      {compact && rows.length === 0 ? (
        <p className="text-sm text-ivory/50">Nothing spent yet this month.</p>
      ) : (
        <table className={`w-full min-w-0 flex-1 text-sm ${compact ? "" : "lg:max-w-lg"}`}>
          <caption className="sr-only">Spending by category</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Spent</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const share = total > 0 ? Math.round((c.spent / total) * 100) : 0;
              const over = c.planned > 0 && c.spent > c.planned;
              const usage = c.planned > 0 ? Math.min(100, (c.spent / c.planned) * 100) : 0;
              // A folded category lights up the "Other" slice.
              const slice =
                c.spent <= 0 ? -1 : sliceIndex(c.name) >= 0 ? sliceIndex(c.name) : pieData.length - 1;
              const isActive = active === slice;
              return (
                <tr
                  key={c.name}
                  onPointerEnter={() => setActive(slice)}
                  onPointerLeave={() => setActive(null)}
                  className={`transition-opacity duration-300 ${active !== null && !isActive ? "opacity-40" : ""}`}
                >
                  <th scope="row" className="py-2 pr-3 text-left font-medium">
                    <span className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-full transition-transform duration-300"
                        style={{ background: c.color, transform: isActive ? "scale(1.5)" : undefined }}
                      />
                      <span className="min-w-0">
                        <span className={`block truncate ${c.spent > 0 ? "text-ivory" : "text-ivory/45"}`}>{c.name}</span>
                        {!compact && c.planned > 0 && (
                          <span className="mt-1.5 block h-1 w-full max-w-40 overflow-hidden rounded-full bg-white/[0.07]">
                            <span
                              className={`block h-full rounded-full ${over ? "bg-coral" : "bg-ivory/50"}`}
                              style={{ width: `${usage}%` }}
                            />
                          </span>
                        )}
                      </span>
                    </span>
                  </th>
                  <td className="py-2 pl-2 text-right align-top">
                    <span className={`block font-semibold tabular ${c.spent > 0 ? "text-ivory" : "text-ivory/40"}`}>
                      {formatCurrency(c.spent)}
                    </span>
                    {!compact && c.planned > 0 && (
                      <span className={`block text-xs tabular ${over ? "text-coral" : "text-ivory/45"}`}>
                        {over ? `${formatCurrency(c.spent - c.planned)} over` : `of ${formatCurrency(c.planned)}`}
                      </span>
                    )}
                  </td>
                  <td className="w-12 py-2 pl-3 text-right align-top text-xs font-semibold tabular text-ivory/50">
                    {share}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
