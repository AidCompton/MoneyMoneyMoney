"use client";

import { type RefObject } from "react";
import { gsap, useGSAP } from "./gsap";

/** Pulls an element gently toward the pointer while it hovers. Mouse only. */
export function useMagnetic<T extends HTMLElement>(ref: RefObject<T | null>, strength = 0.3) {
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)", () => {
        const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3.out" });
        const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" });
        const onMove = (e: PointerEvent) => {
          const rect = el.getBoundingClientRect();
          xTo((e.clientX - rect.left - rect.width / 2) * strength);
          yTo((e.clientY - rect.top - rect.height / 2) * strength);
        };
        const onLeave = () => {
          gsap.to(el, { x: 0, y: 0, duration: 1, ease: "elastic.out(1, 0.4)" });
        };
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerleave", onLeave);
        return () => {
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerleave", onLeave);
        };
      });
    },
    { dependencies: [strength] },
  );
}
