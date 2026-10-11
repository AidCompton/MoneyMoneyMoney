"use client";

import { ButtonHTMLAttributes, useRef } from "react";
import { useMagnetic } from "@/components/motion/useMagnetic";
import { buttonClasses, type Size, type Variant } from "./buttonClasses";

export function Button({
  variant = "primary",
  size = "md",
  magnetic = variant === "primary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  magnetic?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useMagnetic(ref, magnetic ? 0.25 : 0);

  return (
    <button ref={ref} className={buttonClasses({ variant, size, className })} {...props}>
      {variant === "primary" && (
        <span
          aria-hidden
          className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
        />
      )}
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </button>
  );
}
