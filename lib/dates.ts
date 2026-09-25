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
