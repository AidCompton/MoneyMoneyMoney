/**
 * The large editorial heading at the top of each page. `accent` renders in
 * the italic serif, gold, after the main title.
 */
export function PageHeader({
  eyebrow,
  title,
  accent,
  children,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6 pb-2">
      <div className="min-w-0">
        <p data-reveal className="mb-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-mint/80">
          <span className="h-px w-8 bg-mint/60" />
          {eyebrow}
        </p>
        <h1 data-split className="font-display text-[clamp(2.75rem,8vw,6rem)] text-ivory">
          {title}
          {accent && (
            <>
              {" "}
              <span className="font-accent text-gradient-gold pr-2">{accent}</span>
            </>
          )}
        </h1>
      </div>
      {children && <div data-reveal>{children}</div>}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <h2 className="text-lg font-semibold tracking-tight text-ivory">{children}</h2>
      {action}
    </div>
  );
}
