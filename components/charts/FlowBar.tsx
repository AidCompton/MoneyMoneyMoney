"use client";

import { useRef, useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { gsap, useGSAP, prefersReducedMotion } from "@/components/motion/gsap";

export type FlowSegment = { key: string; label: string; value: number; color: string };

/**
 * Where the money went, as one bar split into parts of the whole. Segments
 * grow in one after another; hovering a segment or its legend entry
 * highlights it.
 */
export function FlowBar({
  segments,
  whole,
  wholeLabel = "income",
}: {
  segments: FlowSegment[];
  /** What the percentages are of (usually income). Defaults to the sum. */
  whole?: number;
  wholeLabel?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  const shown = segments.filter((s) => s.value > 0);
  const sum = shown.reduce((total, s) => total + s.value, 0);
  const base = Math.max(whole ?? 0, sum, 1);
  const signature = shown.map((s) => `${s.key}:${s.value}`).join("|");

  useGSAP(
    () => {
      if (prefersReducedMotion() || !shown.length) return;
      gsap.fromTo(
        "[data-seg]",
        { scaleX: 0 },
        { scaleX: 1, duration: 1.1, stagger: 0.12, ease: "expo.out", transformOrigin: "left", delay: 0.3 },
      );
    },
    { scope: root, dependencies: [signature] },
  );

  return (
    <div ref={root}>
      <div
        role="img"
        aria-label={shown.map((s) => `${s.label} ${formatCurrency(s.value)}`).join(", ")}
        className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full bg-white/[0.06]"
        onPointerLeave={() => setActive(null)}
      >
        {shown.map((s) => (
          <span
            key={s.key}
            data-seg
            onPointerEnter={() => setActive(s.key)}
            className="h-full transition-opacity duration-300 first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(s.value / base) * 100}%`,
              background: s.color,
              opacity: active && active !== s.key ? 0.3 : 1,
            }}
          />
        ))}
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        {segments.map((s) => (
          <li
            key={s.key}
            onPointerEnter={() => setActive(s.key)}
            onPointerLeave={() => setActive(null)}
            className={`min-w-0 transition-opacity duration-300 ${active && active !== s.key ? "opacity-40" : ""}`}
          >
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ivory/50">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="truncate">{s.label}</span>
            </p>
            <p className="mt-1 text-lg font-semibold tabular tracking-tight">
              {formatCurrency(s.value)}
              {whole ? (
                <span className="ml-2 text-xs font-medium text-ivory/40">
                  {Math.round((Math.max(0, s.value) / Math.max(whole, 1)) * 100)}% of {wholeLabel}
                </span>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
