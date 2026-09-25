// Reading and checking form fields in server actions.

export function str(fd: FormData, name: string) {
  return String(fd.get(name) ?? "").trim();
}

export function optionalStr(fd: FormData, name: string) {
  return str(fd, name) || null;
}

/**
 * A money amount, accepting "1 250,50" as well as "1250.50". Returns null
 * when the field is empty and NaN when it isn't a number.
 */
export function money(fd: FormData, name: string) {
  const raw = str(fd, name).replace(/[\s ]/g, "").replace(/^R/i, "").replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : NaN;
}

export function isISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}
