"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { gsap, useGSAP } from "@/components/motion/gsap";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/goals", label: "Goals" },
  { href: "/budget", label: "Budget" },
  { href: "/meetings", label: "Meetings" },
  { href: "/household", label: "Household" },
];

/** Pill navigation with a gold indicator that glides to the active page. */
export function MainNav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  const activeHref = links.find((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))?.href;

  useGSAP(
    () => {
      const move = (animate: boolean) => {
        const active = nav.current?.querySelector<HTMLElement>("[data-active='true']");
        if (!indicator.current) return;
        if (!active) {
          gsap.to(indicator.current, { autoAlpha: 0, duration: 0.3 });
          return;
        }
        const props = {
          x: active.offsetLeft,
          width: active.offsetWidth,
          autoAlpha: 1,
        };
        if (animate) {
          gsap.to(indicator.current, { ...props, duration: 0.7, ease: "expo.out" });
        } else {
          gsap.set(indicator.current, props);
        }
      };
      move(placed.current);
      placed.current = true;

      const onResize = () => move(false);
      window.addEventListener("resize", onResize);
      document.fonts?.ready.then(() => move(false));
      return () => window.removeEventListener("resize", onResize);
    },
    { dependencies: [activeHref], scope: nav },
  );

  return (
    <nav
      ref={nav}
      aria-label="Main"
      className={`relative flex items-center gap-1 rounded-full p-1 ${compact ? "justify-between" : ""}`}
    >
      <span
        ref={indicator}
        aria-hidden
        className="invisible absolute left-0 top-1 bottom-1 rounded-full bg-gradient-to-r from-gold to-sunrise shadow-[0_6px_20px_-6px_rgb(247_195_92/0.8)]"
      />
      {links.map((link) => {
        const active = link.href === activeHref;
        return (
          <Link
            key={link.href}
            href={link.href}
            data-active={active}
            aria-current={active ? "page" : undefined}
            className={`relative z-10 whitespace-nowrap rounded-full py-2 font-semibold ${
              compact ? "px-2.5 text-[12px]" : "px-4 text-sm"
            } tracking-tight transition-colors duration-500 ${
              active ? "text-night" : "text-ivory/65 hover:text-ivory"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
