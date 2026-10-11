export function FormError({ message, className = "" }: { message?: string; className?: string }) {
  if (!message) return null;
  return (
    <p
      className={`row-enter rounded-2xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm text-coral ${className}`}
      role="alert"
    >
      {message}
    </p>
  );
}
