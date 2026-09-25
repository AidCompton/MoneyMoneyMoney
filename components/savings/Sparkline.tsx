"use client";

import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/components/motion/gsap";

/** A tiny balance-over-time line that draws itself in. */
export function Sparkline({ values, width = 140, height = 40 }: { values: number[]; width?: number; height?: number }) {
  const path = useRef<SVGPathElement>(null);
  const series = values.length === 1 ? [values[0], values[0]] : values;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const d = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * width;
      const y = height - 3 - ((v - min) / span) * (height - 6);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  useGSAP(
    () => {
      if (!path.current || prefersReducedMotion()) return;
      const length = path.current.getTotalLength();
      gsap.fromTo(
        path.current,
        { strokeDasharray: length, strokeDashoffset: length },
        { strokeDashoffset: 0, duration: 1.6, ease: "power3.inOut", delay: 0.3 },
      );
    },
    { dependencies: [d] },
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden className="overflow-visible">
      <path ref={path} d={d} fill="none" stroke="#4fe3a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
