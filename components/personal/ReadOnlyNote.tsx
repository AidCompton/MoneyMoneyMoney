/** Shown on your partner's personal pages: you can look, but only they can change things. */
export function ReadOnlyNote({ name }: { name: string }) {
  return (
    <p
      data-reveal
      className="glass flex items-center gap-3 rounded-2xl px-5 py-3 text-sm text-ivory/70"
      role="note"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-mint" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z" />
        <circle cx="10" cy="10" r="2.5" />
      </svg>
      You&apos;re viewing {name}&apos;s personal money. Only {name} can add or change things here.
    </p>
  );
}
