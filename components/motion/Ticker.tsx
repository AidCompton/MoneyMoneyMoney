"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "./gsap";

/** An endlessly scrolling line of words. Duplicated once for a seamless loop. */
export function Ticker({ items }: { items: string[] }) {
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.to(track.current, { xPercent: -50, duration: 28, ease: "none", repeat: -1 });
      });
    },
    { scope: track },
  );

  const row = items.map((item, i) => (
    <span key={i} className="flex items-center gap-8 pr-8">
      <span>{item}</span>
      <span className="text-gold">✦</span>
    </span>
  ));

  return (
    <div aria-hidden className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
      <div ref={track} className="flex w-max whitespace-nowrap">
        {row}
        {row}
      </div>
    </div>
  );
}
