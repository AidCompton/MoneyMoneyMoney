"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "./gsap";

const blobs = [
  { className: "left-[-10%] top-[-15%] h-[55vmax] w-[55vmax]", color: "rgb(22 160 110 / 0.55)" },
  { className: "right-[-15%] top-[10%] h-[45vmax] w-[45vmax]", color: "rgb(247 195 92 / 0.28)" },
  { className: "left-[20%] bottom-[-25%] h-[50vmax] w-[50vmax]", color: "rgb(18 120 110 / 0.45)" },
  { className: "right-[5%] bottom-[-10%] h-[30vmax] w-[30vmax]", color: "rgb(255 157 92 / 0.2)" },
];

/**
 * The drifting light behind the glass. Four soft blobs wander on long
 * sine loops and lean slightly toward the pointer.
 */
export function Aurora() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.utils.toArray<HTMLElement>("[data-blob]").forEach((blob, i) => {
          gsap.to(blob, {
            xPercent: gsap.utils.random(-25, 25),
            yPercent: gsap.utils.random(-20, 20),
            scale: gsap.utils.random(0.85, 1.2),
            duration: gsap.utils.random(14, 22),
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
            delay: i * -3,
          });
        });

        const field = root.current?.querySelector<HTMLElement>("[data-field]");
        if (!field) return;
        const xTo = gsap.quickTo(field, "x", { duration: 2.4, ease: "power3.out" });
        const yTo = gsap.quickTo(field, "y", { duration: 2.4, ease: "power3.out" });
        const onMove = (e: PointerEvent) => {
          xTo((e.clientX / window.innerWidth - 0.5) * 60);
          yTo((e.clientY / window.innerHeight - 0.5) * 40);
        };
        window.addEventListener("pointermove", onMove);
        return () => window.removeEventListener("pointermove", onMove);
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div data-field className="absolute inset-0">
        {blobs.map((blob, i) => (
          <div
            key={i}
            data-blob
            className={`absolute rounded-full blur-[90px] ${blob.className}`}
            style={{ background: `radial-gradient(circle at center, ${blob.color} 0%, transparent 65%)` }}
          />
        ))}
      </div>
      {/* Fine grid lines fading out toward the bottom, for depth. */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(255 255 255 / 0.035) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.035) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 75%)",
        }}
      />
    </div>
  );
}
