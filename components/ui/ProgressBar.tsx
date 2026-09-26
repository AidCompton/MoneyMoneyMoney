"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/components/motion/gsap";

type Tone = "growth" | "spend" | "over";

const fills: Record<Tone, string> = {
  growth: "from-jade via-mint to-gold",
  spend: "from-mint via-gold to-sunrise",
  over: "from-sunrise to-coral",
};

/** A glowing progress track whose fill sweeps in from the left. */
export function ProgressBar({
  percent,
  tone = "growth",
  size = "md",
  label,
}: {
  percent: number;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const fill = useRef<HTMLDivElement>(null);
  const shown = useRef(0);
  const clamped = Math.min(100, Math.max(0, percent));
  const height = { sm: "h-1.5", md: "h-2.5", lg: "h-4" }[size];

  useGSAP(
    () => {
      if (!fill.current) return;
      const to = clamped / 100;
      if (prefersReducedMotion()) {
        gsap.set(fill.current, { scaleX: to });
      } else {
        gsap.fromTo(
          fill.current,
          { scaleX: shown.current },
          { scaleX: to, duration: 1.6, delay: shown.current === 0 ? 0.35 : 0, ease: "expo.out" },
        );
      }
      shown.current = to;
    },
    { dependencies: [clamped] },
  );

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
      className={`${height} w-full overflow-hidden rounded-full bg-white/[0.07] ring-1 ring-inset ring-white/5`}
    >
      <div
        ref={fill}
        className={`shimmer h-full origin-left rounded-full bg-gradient-to-r ${fills[tone]} shadow-[0_0_18px_rgb(79_227_165/0.45)]`}
        style={{ transform: `scaleX(${clamped / 100})` }}
      />
    </div>
  );
}
