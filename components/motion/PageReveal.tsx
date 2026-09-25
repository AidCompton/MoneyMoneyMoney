"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, SplitText, useGSAP, REDUCED_MOTION } from "./gsap";

/**
 * Choreographs a page's entrance. Inside it:
 *  - `data-split` headings rise in line by line from behind a mask (lines, not
 *    words, so gradient-clipped accent text survives the split intact)
 *  - `data-reveal` blocks lift and un-blur in a stagger as they scroll into view
 *
 * Rendered from a route template, so it re-runs on every navigation.
 */
export function PageReveal({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(REDUCED_MOTION, () => {
        gsap.set("[data-reveal], [data-split]", { autoAlpha: 1 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const headings = gsap.utils.toArray<HTMLElement>("[data-split]");
        headings.forEach((heading, i) => {
          SplitText.create(heading, {
            type: "lines",
            mask: "lines",
            autoSplit: true,
            onSplit(self) {
              gsap.set(heading, { autoAlpha: 1 });
              return gsap.from(self.lines, {
                yPercent: 110,
                rotate: 2,
                transformOrigin: "0% 100%",
                duration: 1.4,
                stagger: 0.1,
                delay: 0.05 + i * 0.12,
              });
            },
          });
        });

        const blocks = gsap.utils.toArray<HTMLElement>("[data-reveal]");
        gsap.set(blocks, { autoAlpha: 0, y: 36, filter: "blur(10px)" });
        ScrollTrigger.batch(blocks, {
          start: "top 92%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              autoAlpha: 1,
              y: 0,
              filter: "blur(0px)",
              duration: 1.2,
              stagger: 0.08,
              delay: 0.15,
              clearProps: "filter,transform",
            }),
        });
      });
    },
    { scope: root },
  );

  return <div ref={root}>{children}</div>;
}
