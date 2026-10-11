/** Builds a URL, leaving out empty params. */
export function withParams(base: string, params: Record<string, string | undefined | null>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}
