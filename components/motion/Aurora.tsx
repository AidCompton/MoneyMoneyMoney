"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";
import { spaceOf } from "@/components/shell/nav";
import { gsap, useGSAP } from "./gsap";

const blobs = [
  { className: "left-[-10%] top-[-15%] h-[55vmax] w-[55vmax]", tone: "--aurora-1" },
  { className: "right-[-15%] top-[10%] h-[45vmax] w-[45vmax]", tone: "--aurora-2" },
  { className: "left-[20%] bottom-[-25%] h-[50vmax] w-[50vmax]", tone: "--aurora-3" },
  { className: "right-[5%] bottom-[-10%] h-[30vmax] w-[30vmax]", tone: "--aurora-4" },
];

// Shared money glows warm gold; personal money cools to mint and teal.
const tones = {
  shared: {
    "--aurora-1": "rgba(22, 160, 110, 0.55)",
    "--aurora-2": "rgba(247, 195, 92, 0.28)",
    "--aurora-3": "rgba(18, 120, 110, 0.45)",
    "--aurora-4": "rgba(255, 157, 92, 0.2)",
  },
  personal: {
    "--aurora-1": "rgba(22, 160, 110, 0.5)",
    "--aurora-2": "rgba(79, 227, 165, 0.26)",
    "--aurora-3": "rgba(24, 110, 150, 0.45)",
    "--aurora-4": "rgba(144, 133, 233, 0.2)",
  },
};

/**
 * The drifting light behind the glass. Four soft blobs wander on long sine
 * loops, lean slightly toward the pointer, and change hue between the shared
 * and personal spaces.
 */
export function Aurora() {
  const root = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const mood = spaceOf(pathname) === "personal" ? "personal" : "shared";
  const first = useRef(true);

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

  useGSAP(
    () => {
      if (!root.current) return;
      const target = tones[mood];
      if (first.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(root.current, target);
      } else {
        gsap.to(root.current, { ...target, duration: 1.8, ease: "sine.inOut" });
      }
      first.current = false;
    },
    { dependencies: [mood] },
  );

  return (
    <div
      ref={root}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={tones.shared as React.CSSProperties}
    >
      <div data-field className="absolute inset-0">
        {blobs.map((blob) => (
          <div
            key={blob.tone}
            data-blob
            className={`absolute rounded-full blur-[90px] ${blob.className}`}
            style={{ background: `radial-gradient(circle at center, var(${blob.tone}) 0%, transparent 65%)` }}
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
