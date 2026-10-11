"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/components/motion/gsap";
import { activeKey, spaceOf, subLinks } from "./nav";

type Member = { id: string; name: string };

/**
 * The pages inside the current space, with an underline that slides between
 * them. In the personal space it also switches between the two of you.
 */
export function SubNav({ members, userId }: { members: Member[]; userId: string }) {
  const pathname = usePathname();
  const space = spaceOf(pathname);
  const links = subLinks(space, pathname);
  const current = activeKey(links, pathname);
  const root = useRef<HTMLDivElement>(null);
  const underline = useRef<HTMLSpanElement>(null);
  const lastSpace = useRef<string | null>(null);

  const personId = space === "personal" ? pathname.split("/")[2] : null;
  const rest = personId ? pathname.split("/").slice(3).join("/") : "";

  useGSAP(
    () => {
      if (!root.current) return;
      const reduced = prefersReducedMotion();
      // New space: the links rise in one after another.
      if (lastSpace.current !== space && !reduced) {
        gsap.fromTo(
          root.current.querySelectorAll("[data-sub]"),
          { autoAlpha: 0, y: 8 },
          { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.05, ease: "expo.out" },
        );
      }
      lastSpace.current = space;

      const active = root.current.querySelector<HTMLElement>("[data-sub][data-active='true']");
      if (!underline.current) return;
      if (!active) {
        gsap.set(underline.current, { autoAlpha: 0 });
        return;
      }
      const props = { x: active.offsetLeft, width: active.offsetWidth, autoAlpha: 1 };
      if (reduced) gsap.set(underline.current, props);
      else gsap.to(underline.current, { ...props, duration: 0.6, ease: "expo.out" });
    },
    { dependencies: [space, current, personId], scope: root },
  );

  if (!links.length) return null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-5 sm:px-6">
      <div ref={root} className="relative flex max-w-full items-center gap-1 overflow-x-auto [scrollbar-width:none]">
        {links.map((link) => {
          const active = link.key === current;
          return (
            <Link
              key={link.key}
              href={link.href}
              data-sub
              data-active={active}
              aria-current={active ? "page" : undefined}
              className={`relative whitespace-nowrap px-3 py-2 text-sm font-semibold transition-colors duration-300 ${
                active ? "text-ivory" : "text-ivory/50 hover:text-ivory/80"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
        <span
          ref={underline}
          aria-hidden
          className={`invisible absolute bottom-0 left-0 h-0.5 rounded-full ${
            space === "personal" ? "bg-mint shadow-[0_0_10px] shadow-mint" : "bg-gold shadow-[0_0_10px] shadow-gold"
          }`}
        />
      </div>

      {space === "personal" && members.length > 1 && (
        <div className="glass flex items-center gap-1 rounded-full p-1" aria-label="Whose money">
          {members.map((m) => {
            const active = m.id === personId;
            return (
              <Link
                key={m.id}
                href={`/personal/${m.id}${rest ? `/${rest.split("/")[0]}` : ""}`}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm font-semibold transition-colors duration-300 ${
                  active ? "bg-mint/15 text-ivory" : "text-ivory/55 hover:text-ivory"
                }`}
              >
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                    active ? "bg-mint text-night" : "bg-white/10 text-ivory/70"
                  }`}
                >
                  {m.name.slice(0, 1).toUpperCase()}
                </span>
                {m.id === userId ? "You" : m.name}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
