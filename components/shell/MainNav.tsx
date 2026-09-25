"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { gsap, useGSAP } from "@/components/motion/gsap";
import { primaryLinks, spaceOf } from "./nav";

/**
 * The four spaces, as a pill with an indicator that glides to the active one.
 * Gold in shared spaces, mint in personal ones.
 */
export function MainNav({ userId, compact = false }: { userId: string; compact?: boolean }) {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);
  const links = primaryLinks(userId);
  const space = spaceOf(pathname);

  useGSAP(
    () => {
      const move = (animate: boolean) => {
        const active = nav.current?.querySelector<HTMLElement>("[data-active='true']");
        if (!indicator.current || !active) return;
        const props = { x: active.offsetLeft, width: active.offsetWidth, autoAlpha: 1 };
        if (animate) gsap.to(indicator.current, { ...props, duration: 0.7, ease: "expo.out" });
        else gsap.set(indicator.current, props);
      };
      move(placed.current);
      placed.current = true;

      const onResize = () => move(false);
      window.addEventListener("resize", onResize);
      document.fonts?.ready.then(() => move(false));
      return () => window.removeEventListener("resize", onResize);
    },
    { dependencies: [space], scope: nav },
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
        className={`invisible absolute bottom-1 left-0 top-1 rounded-full bg-gradient-to-r transition-[background-image,box-shadow] duration-700 ${
          space === "personal"
            ? "from-mint to-[#9ff0cf] shadow-[0_6px_20px_-6px_rgb(79_227_165/0.8)]"
            : "from-gold to-sunrise shadow-[0_6px_20px_-6px_rgb(247_195_92/0.8)]"
        }`}
      />
      {links.map((link) => {
        const active = link.key === space;
        return (
          <Link
            key={link.key}
            href={link.href}
            data-active={active}
            aria-current={active ? "page" : undefined}
            className={`relative z-10 whitespace-nowrap rounded-full py-2 font-semibold tracking-tight transition-colors duration-500 ${
              compact ? "flex-1 px-2 text-center text-[13px]" : "px-4 text-sm"
            } ${active ? "text-night" : "text-ivory/65 hover:text-ivory"}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
