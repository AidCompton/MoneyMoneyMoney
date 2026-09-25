/** A small labelled figure, used in rows beneath hero numbers. */
export function Stat({
  label,
  children,
  tone = "ivory",
}: {
  label: string;
  children: React.ReactNode;
  tone?: "ivory" | "mint" | "gold" | "coral";
}) {
  const color = { ivory: "text-ivory", mint: "text-mint", gold: "text-gold", coral: "text-coral" }[tone];
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ivory/45">{label}</p>
      <p className={`mt-1.5 truncate text-xl font-semibold tracking-tight tabular sm:text-2xl ${color}`}>
        {children}
      </p>
    </div>
  );
}
