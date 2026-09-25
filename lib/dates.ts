import { format, parseISO } from "date-fns";

// Dates are stored as plain "YYYY-MM-DD" strings. Parsing them with
// parseISO keeps them in local time, so a date never shifts by a day the
// way `new Date("2026-09-25")` (which is read as UTC midnight) can.

/** Today as YYYY-MM-DD in the local time zone. */
export function todayISO(now = new Date()) {
  return format(now, "yyyy-MM-dd");
}

/** This month as YYYY-MM in the local time zone. */
export function monthISO(now = new Date()) {
  return format(now, "yyyy-MM");
}

/** "25 Sep 2026" */
export function formatDay(iso: string) {
  return format(parseISO(iso), "d MMM yyyy");
}

/** "Friday, 25 September 2026" */
export function formatLongDay(iso: string) {
  return format(parseISO(iso), "EEEE, d MMMM yyyy");
}

export function isMonth(value: string | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** A valid YYYY-MM from a search param, or this month. */
export function monthParam(value: string | undefined, now = new Date()) {
  return isMonth(value) ? value : monthISO(now);
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return format(new Date(y, m - 1 + delta, 1), "yyyy-MM");
}

/** "September 2026" */
export function formatMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return format(new Date(y, m - 1, 1), "MMMM yyyy");
}

/** SQL LIKE pattern matching every YYYY-MM-DD date in a month. */
export function monthPattern(month: string) {
  return `${month}-%`;
}

/** First and last day of a month, as YYYY-MM-DD. */
export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { first: `${month}-01`, last: format(new Date(y, m, 0), "yyyy-MM-dd") };
}
