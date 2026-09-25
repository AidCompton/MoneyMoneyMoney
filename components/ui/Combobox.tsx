"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/components/motion/gsap";
import { cleanName, nameKey } from "@/lib/lists";
import { fieldClasses } from "./Input";

export type ComboOption = { value: string; hint?: string; color?: string };

/**
 * A text field with a dropdown of everything entered before. Typing filters
 * the list; anything new shows an "Add …" option and is added to the list
 * when the form is saved (the server matches names regardless of case, so
 * the list never gets duplicates).
 */
export function Combobox({
  id,
  name,
  options,
  defaultValue = "",
  placeholder,
  required,
  autoFocus,
  allowCreate = true,
  noun = "",
  onValueChange,
  onPick,
  className = "",
}: {
  id: string;
  name: string;
  options: (string | ComboOption)[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  allowCreate?: boolean;
  /** Used in "Add new {noun}" hints. */
  noun?: string;
  onValueChange?: (value: string) => void;
  /** Called when an existing option is chosen. */
  onPick?: (option: ComboOption) => void;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();

  const all = useMemo(
    () => options.map((o) => (typeof o === "string" ? { value: o } : o)),
    [options],
  );

  const query = nameKey(value);
  const matches = useMemo(() => {
    const found = all.filter((o) => !query || nameKey(o.value).includes(query));
    // Names starting with what you typed come first.
    found.sort((a, b) => Number(nameKey(b.value).startsWith(query)) - Number(nameKey(a.value).startsWith(query)));
    return found.slice(0, 8);
  }, [all, query]);
  const exists = all.some((o) => nameKey(o.value) === query);
  const showCreate = allowCreate && !!query && !exists;
  const items: (ComboOption & { create?: boolean })[] = [
    ...matches,
    ...(showCreate ? [{ value: cleanName(value), create: true }] : []),
  ];
  const expanded = open && items.length > 0;

  // React resets forms after a successful action; follow suit.
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const reset = () => setValue(defaultValue);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultValue]);

  useGSAP(
    () => {
      if (!expanded || !list.current || prefersReducedMotion()) return;
      gsap.fromTo(
        list.current,
        { autoAlpha: 0, y: -6, scaleY: 0.97 },
        { autoAlpha: 1, y: 0, scaleY: 1, duration: 0.35, ease: "power3.out", transformOrigin: "top" },
      );
      gsap.fromTo(
        list.current.children,
        { autoAlpha: 0, x: -6 },
        { autoAlpha: 1, x: 0, duration: 0.3, stagger: 0.025, ease: "power2.out" },
      );
    },
    { dependencies: [expanded] },
  );

  function change(next: string) {
    setValue(next);
    onValueChange?.(next);
    // Typing an existing name in full counts as picking it.
    const exact = all.find((o) => nameKey(o.value) === nameKey(next));
    if (exact) onPick?.(exact);
  }

  function choose(item: ComboOption & { create?: boolean }) {
    change(item.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && expanded && items[active]) {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const highlight = (text: string) => {
    if (!query) return text;
    const at = nameKey(text).indexOf(query);
    if (at < 0) return text;
    return (
      <>
        {text.slice(0, at)}
        <span className="text-gold">{text.slice(at, at + query.length)}</span>
        {text.slice(at + query.length)}
      </>
    );
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={input}
        id={id}
        name={name}
        value={value}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded ? `${listId}-${active}` : undefined}
        className={`${fieldClasses} pr-9`}
        onChange={(e) => {
          change(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className={`pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ivory/40 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {expanded && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-72 overflow-auto rounded-2xl border border-white/12 bg-[#0d2019]/95 p-1.5 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)] backdrop-blur-xl"
        >
          {items.map((item, i) => (
            <li
              key={`${item.create ? "+" : ""}${item.value}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus in the field
                choose(item);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
                i === active ? "bg-white/[0.09]" : ""
              } ${item.create ? "text-gold" : "text-ivory/85"}`}
            >
              {item.create ? (
                <span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-gold/15 text-xs">
                  +
                </span>
              ) : item.color ? (
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: item.color }} />
              ) : null}
              <span className="min-w-0 flex-1 truncate">
                {item.create ? (
                  <>
                    Add “{item.value}”{noun && <span className="text-ivory/40"> as a new {noun}</span>}
                  </>
                ) : (
                  highlight(item.value)
                )}
              </span>
              {item.hint && !item.create && <span className="shrink-0 text-xs text-ivory/40">{item.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
