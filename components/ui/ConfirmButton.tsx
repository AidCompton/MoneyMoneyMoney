"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * A two-step submit button for destructive actions: the first click arms
 * it ("Sure?"), the second submits. It disarms itself after a few seconds.
 * Must be rendered inside a <form>.
 */
export function ConfirmButton({
  label,
  confirmLabel = "Sure?",
  icon = false,
  className = "",
}: {
  label: string;
  confirmLabel?: string;
  icon?: boolean;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={armed ? `Confirm: ${label}` : label}
      onClick={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
        }
      }}
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-all duration-300 disabled:opacity-50 ${
        armed
          ? "bg-coral/20 px-3 text-coral ring-1 ring-inset ring-coral/40"
          : icon
            ? "w-8 text-ivory/35 hover:bg-white/[0.07] hover:text-coral"
            : "px-3 text-ivory/50 hover:bg-white/[0.07] hover:text-coral"
      } ${className}`}
    >
      {armed ? confirmLabel : icon ? <TrashIcon /> : label}
    </button>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m2 0-.6 9.1a2 2 0 0 1-2 1.9H8.6a2 2 0 0 1-2-1.9L6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
