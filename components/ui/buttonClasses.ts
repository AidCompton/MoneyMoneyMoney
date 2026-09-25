// Shared by <Button> and by links styled as buttons in Server Components.

export type Variant = "primary" | "secondary" | "ghost" | "danger";
export type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-gold via-[#ffcf73] to-sunrise text-night shadow-[0_10px_30px_-10px_rgb(247_195_92/0.7)] hover:shadow-[0_14px_40px_-8px_rgb(247_195_92/0.85)]",
  secondary: "glass text-ivory hover:bg-white/10",
  ghost: "text-ivory/70 hover:bg-white/[0.06] hover:text-ivory",
  danger: "bg-coral/15 text-coral ring-1 ring-inset ring-coral/30 hover:bg-coral/25",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-6 text-sm",
  lg: "h-14 px-8 text-base",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className = "",
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return `group relative inline-flex select-none items-center justify-center gap-2 overflow-hidden rounded-full font-semibold tracking-tight transition-[background-color,box-shadow,color,opacity] duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;
}
