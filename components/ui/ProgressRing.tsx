"use client";

import { useId, useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/components/motion/gsap";

type Tone = "growth" | "spend" | "over";

const stops: Record<Tone, [string, string]> = {
  growth: ["#4fe3a5", "#f7c35c"],
  spend: ["#4fe3a5", "#ff9d5c"],
  over: ["#ff9d5c", "#ff7a70"],
};

/** Circular progress with a gradient stroke that draws itself in. */
export function ProgressRing({
  percent,
  size = 220,
  stroke = 14,
  tone = "growth",
  children,
  label,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  tone?: Tone;
  children?: React.ReactNode;
  label?: string;
}) {
  const arc = useRef<SVGCircleElement>(null);
  const shown = useRef(0);
  const gradientId = useId();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offsetFor = (p: number) => circumference * (1 - p / 100);

  useGSAP(
    () => {
      if (!arc.current) return;
      if (prefersReducedMotion()) {
        gsap.set(arc.current, { strokeDashoffset: offsetFor(clamped) });
      } else {
        gsap.fromTo(
          arc.current,
          { strokeDashoffset: offsetFor(shown.current) },
          {
            strokeDashoffset: offsetFor(clamped),
            duration: 2,
            delay: shown.current === 0 ? 0.4 : 0,
            ease: "expo.out",
          },
        );
      }
      shown.current = clamped;
    },
    { dependencies: [clamped, circumference] },
  );

  const [from, to] = stops[tone];

  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
    >
      {/* Soft round glow (a CSS filter on the SVG would glow as a square
          against the glass behind it). */}
      <div
        aria-hidden
        className="absolute inset-[12%] rounded-full opacity-40 blur-2xl"
        style={{ background: `radial-gradient(circle, ${from}55, transparent 70%)` }}
      />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative -rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(255 255 255 / 0.07)"
          strokeWidth={stroke}
        />
        <circle
          ref={arc}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offsetFor(clamped)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
