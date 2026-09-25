"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { gsap, useGSAP, prefersReducedMotion } from "@/components/motion/gsap";
import { CountUp } from "@/components/motion/CountUp";

export type PieDatum = { label: string; value: number; color: string };

type PieContextValue = {
  data: PieDatum[];
  total: number;
  size: number;
  innerRadius: number;
  /** 0 → 1 while the ring sweeps in. */
  progress: number;
  active: number | null;
  setActive: (index: number | null) => void;
};

const PieContext = createContext<PieContextValue | null>(null);

function usePie() {
  const ctx = useContext(PieContext);
  if (!ctx) throw new Error("PieSlice and PieCenter must be rendered inside <PieChart>.");
  return ctx;
}

// Gap between slices, in px, kept the same width at the inner and outer edge.
const GAP = 2.5;
// How far the hovered slice lifts out of the ring, in px.
const LIFT = 6;

function polar(r: number, angle: number, c: number) {
  return [c + r * Math.sin(angle), c - r * Math.cos(angle)];
}

function arcPath(c: number, r0: number, r1: number, a0: number, a1: number) {
  const outerPad = Math.min(GAP / 2 / r1, (a1 - a0) / 2);
  const innerPad = Math.min(GAP / 2 / r0, (a1 - a0) / 2);
  const [ox0, oy0] = polar(r1, a0 + outerPad, c);
  const [ox1, oy1] = polar(r1, a1 - outerPad, c);
  const [ix1, iy1] = polar(r0, a1 - innerPad, c);
  const [ix0, iy0] = polar(r0, a0 + innerPad, c);
  const large = a1 - a0 - 2 * outerPad > Math.PI ? 1 : 0;
  return [
    `M${ox0},${oy0}`,
    `A${r1},${r1} 0 ${large} 1 ${ox1},${oy1}`,
    `L${ix1},${iy1}`,
    `A${r0},${r0} 0 ${large} 0 ${ix0},${iy0}`,
    "Z",
  ].join(" ");
}

/**
 * A donut chart. Slices sweep in clockwise from 12 o'clock; hovering or
 * focusing a slice (or a linked legend row, via `active`/`onActiveChange`)
 * lifts it and shows its figures in the centre.
 */
export function PieChart({
  data,
  size = 200,
  innerRadius = 60,
  active: controlledActive,
  onActiveChange,
  label,
  children,
}: {
  data: PieDatum[];
  size?: number;
  innerRadius?: number;
  active?: number | null;
  onActiveChange?: (index: number | null) => void;
  label?: string;
  children: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [ownActive, setOwnActive] = useState<number | null>(null);
  // Starts fully drawn so the server render (and no-JS) shows the real chart;
  // the sweep below restarts it from zero before the card fades in.
  const [progress, setProgress] = useState(1);
  const active = controlledActive !== undefined ? controlledActive : ownActive;
  const setActive = onActiveChange ?? setOwnActive;
  const total = data.reduce((sum, d) => sum + Math.max(0, d.value), 0);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const sweep = { p: 0 };
      setProgress(0);
      gsap.to(sweep, {
        p: 1,
        duration: 1.6,
        delay: 0.3,
        ease: "expo.inOut",
        onUpdate: () => setProgress(sweep.p),
      });
    },
    { scope: root },
  );

  const value = useMemo<PieContextValue>(
    () => ({ data, total, size, innerRadius, progress, active, setActive }),
    [data, total, size, innerRadius, progress, active, setActive],
  );

  const summary =
    label ??
    (total > 0
      ? data
          .filter((d) => d.value > 0)
          .map((d) => `${d.label} ${formatCurrency(d.value)}`)
          .join(", ")
      : "No spending yet");

  return (
    <PieContext.Provider value={value}>
      <div
        ref={root}
        className="relative shrink-0"
        style={{ width: size, height: size }}
        onPointerLeave={() => setActive(null)}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={summary}
          className="overflow-visible"
        >
          {/* Empty track, so the ring's shape reads before any spending. */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={(size / 2 + innerRadius) / 2}
            fill="none"
            stroke="rgb(255 255 255 / 0.06)"
            strokeWidth={size / 2 - innerRadius}
          />
          {children}
        </svg>
      </div>
    </PieContext.Provider>
  );
}

/** One slice of the donut, drawn from `data[index]`. */
export function PieSlice({ index }: { index: number }) {
  const { data, total, size, innerRadius, progress, active, setActive } = usePie();
  const datum = data[index];
  if (!datum || datum.value <= 0 || total <= 0) return null;

  const c = size / 2;
  const before = data.slice(0, index).reduce((sum, d) => sum + Math.max(0, d.value), 0);
  const full = Math.PI * 2 * progress;
  const a0 = (before / total) * full;
  const a1 = ((before + datum.value) / total) * full;
  if (a1 - a0 <= 0.0005) return null;

  const isActive = active === index;
  const dimmed = active !== null && !isActive;
  const mid = (a0 + a1) / 2;
  const lift = isActive ? LIFT : 0;
  const percent = Math.round((datum.value / total) * 100);

  return (
    <path
      d={arcPath(c, innerRadius, c - LIFT, a0, a1)}
      fill={datum.color}
      tabIndex={0}
      role="graphics-symbol"
      aria-label={`${datum.label}: ${formatCurrency(datum.value)}, ${percent}%`}
      onPointerEnter={() => setActive(index)}
      onFocus={() => setActive(index)}
      onBlur={() => setActive(null)}
      style={{
        transform: `translate(${Math.sin(mid) * lift}px, ${-Math.cos(mid) * lift}px)`,
        opacity: dimmed ? 0.3 : 1,
        transition: "transform 400ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease",
        cursor: "pointer",
        outline: "none",
        filter: isActive ? `drop-shadow(0 0 12px ${datum.color}aa)` : undefined,
      }}
    />
  );
}

/**
 * The readout in the hole of the donut: the hovered slice's label, amount
 * and share, or `defaultLabel` and the total when nothing is hovered.
 */
export function PieCenter({ defaultLabel = "Total" }: { defaultLabel?: string }) {
  const { data, total, innerRadius, size, active } = usePie();
  const datum = active !== null ? data[active] : null;
  const width = innerRadius * 2 - 12;

  return (
    // The square box pokes past the round hole into the ring, so it must not
    // swallow the pointer from the slices beneath it.
    <foreignObject
      x={size / 2 - width / 2}
      y={size / 2 - width / 2}
      width={width}
      height={width}
      pointerEvents="none"
    >
      <div
        aria-live="polite"
        className="pointer-events-none flex h-full w-full flex-col items-center justify-center text-center leading-tight"
      >
        <span className="max-w-full truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-ivory/50">
          {datum ? datum.label : defaultLabel}
        </span>
        <span
          className="font-display mt-1 whitespace-nowrap tabular text-ivory"
          style={{ fontSize: Math.max(14, Math.min(30, innerRadius / 3.1)) }}
        >
          {datum && formatCurrency(datum.value)}
          {/* Kept mounted (just hidden) while a slice is hovered, so the
              total doesn't count up from zero again every time. */}
          <span hidden={datum !== null}>
            <CountUp value={total} />
          </span>
        </span>
        {datum && total > 0 && (
          <span className="mt-0.5 text-xs font-semibold tabular text-ivory/60">
            {Math.round((datum.value / total) * 100)}%
          </span>
        )}
      </div>
    </foreignObject>
  );
}
