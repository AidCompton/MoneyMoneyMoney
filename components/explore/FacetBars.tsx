"use client";

import Link from "next/link";
import { useRef } from "react";
import { formatCurrency } from "@/lib/currency";
import { gsap, useGSAP, prefersReducedMotion } from "@/components/motion/gsap";

export type FacetBar = {
  value: string;
  label: string;
  total: number;
  count: number;
  color?: string;
  href: string;
  active: boolean;
};

/**
 * One filter dimension as a ranked list of bars. Each bar is a link that
 * toggles that filter; the bars grow in whenever the numbers change.
 */
export function FacetBars({ title, bars, empty }: { title: string; bars: FacetBar[]; empty: string }) {
  const root = useRef<HTMLDivElement>(null);
  const max = Math.max(1, ...bars.map((b) => b.total));
  const signature = bars.map((b) => `${b.value}:${b.total}:${b.active}`).join("|");

  useGSAP(
    () => {
      if (prefersReducedMotion() || !bars.length) return;
      gsap.fromTo(
        "[data-bar]",
        { scaleX: 0 },
        { scaleX: 1, duration: 1, stagger: 0.05, ease: "expo.out", transformOrigin: "left" },
      );
    },
    { scope: root, dependencies: [signature] },
  );

  return (
    <div ref={root} className="min-w-0">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ivory/45">{title}</h3>
      {bars.length === 0 ? (
        <p className="text-sm text-ivory/40">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {bars.slice(0, 8).map((bar) => (
            <li key={bar.value}>
              <Link
                href={bar.href}
                scroll={false}
                aria-pressed={bar.active}
                className={`group block rounded-xl px-2.5 py-2 transition-colors duration-300 ${
                  bar.active ? "bg-gold/10 ring-1 ring-inset ring-gold/40" : "hover:bg-white/[0.05]"
                }`}
              >
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    {bar.color && (
                      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: bar.color }} />
                    )}
                    <span className={`truncate ${bar.value === "none" ? "italic text-ivory/45" : "text-ivory/85"}`}>
                      {bar.label}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular text-ivory">{formatCurrency(bar.total)}</span>
                </span>
                <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <span
                    data-bar
                    className={`block h-full rounded-full ${bar.active ? "bg-gold" : "bg-ivory/45 group-hover:bg-ivory/70"}`}
                    style={{ width: `${(bar.total / max) * 100}%` }}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
