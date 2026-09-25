"use client";

import { useRef } from "react";
import { formatCurrency } from "@/lib/currency";
import { gsap, useGSAP, prefersReducedMotion } from "./gsap";

const formatters = {
  currency: (n: number) => formatCurrency(n),
  percent: (n: number) => `${Math.round(n)}%`,
  number: (n: number) => Math.round(n).toLocaleString("en-ZA"),
};

/**
 * A number that rolls up to its value. Server-renders the final value, then
 * counts up from zero on mount, and from the old value whenever it changes
 * (e.g. after logging a contribution).
 */
export function CountUp({
  value,
  format = "currency",
  duration = 1.8,
  delay = 0.2,
  className,
}: {
  value: number;
  format?: keyof typeof formatters;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const fmt = formatters[format];

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      if (prefersReducedMotion()) {
        el.textContent = fmt(value);
        shown.current = value;
        return;
      }
      const counter = { n: shown.current };
      el.textContent = fmt(counter.n);
      gsap.to(counter, {
        n: value,
        duration,
        delay: shown.current === 0 ? delay : 0,
        ease: "power4.out",
        onUpdate: () => {
          el.textContent = fmt(counter.n);
          shown.current = counter.n;
        },
        onComplete: () => {
          el.textContent = fmt(value);
          shown.current = value;
        },
      });
    },
    { dependencies: [value] },
  );

  return (
    <span ref={ref} className={`tabular ${className ?? ""}`} suppressHydrationWarning>
      {fmt(value)}
    </span>
  );
}
