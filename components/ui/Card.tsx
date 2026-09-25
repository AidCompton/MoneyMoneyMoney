import { HTMLAttributes } from "react";

/** A frosted glass panel. Pass `reveal` to have it animate in on page load. */
export function Card({
  className = "",
  reveal = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & { reveal?: boolean }) {
  return (
    <div
      data-reveal={reveal ? "" : undefined}
      className={`glass relative min-w-0 rounded-[28px] p-6 sm:p-7 ${className}`}
      {...props}
    />
  );
}
