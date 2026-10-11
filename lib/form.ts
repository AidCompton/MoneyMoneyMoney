// Reading and checking form fields in server actions. Everything a form sends
// is untrusted: text is trimmed and capped in length, amounts must be sane
// numbers, and dates must be real calendar dates.

/** Names, descriptions, stores, comments. */
export const MAX_TEXT = 200;
/** Longer free text, such as meeting notes. */
export const MAX_NOTES = 20_000;
/** No household amount is anywhere near a billion rand. */
export const MAX_AMOUNT = 1_000_000_000;

export function str(fd: FormData, name: string, max = MAX_TEXT) {
  const value = fd.get(name);
  return (typeof value === "string" ? value : "").trim().slice(0, max);
}

export function optionalStr(fd: FormData, name: string, max = MAX_TEXT) {
  return str(fd, name, max) || null;
}

/** Rounds to whole cents. */
export function cents(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * A money amount, accepting "1 250,50" as well as "1250.50". Returns null
 * when the field is empty and NaN when it isn't a sensible number.
 */
export function money(fd: FormData, name: string) {
  const raw = str(fd, name, 40).replace(/[\s ]/g, "").replace(/^R/i, "").replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && Math.abs(value) <= MAX_AMOUNT ? cents(value) : NaN;
}

/** A real YYYY-MM-DD date between 1990 and 2100. */
export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < 1990 || year > 2100) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** An id as this app makes them (a UUID), so junk never reaches a query. */
export function isId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
