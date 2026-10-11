/**
 * Pay periods: the heart of Monera. A period runs from one payday to the day
 * before the next, and is keyed "YYYY-MM" by the month it starts in. Dates are
 * "YYYY-MM-DD" strings, which sort and compare as strings.
 */

export const MS_PER_DAY = 86_400_000;

/** A "YYYY-MM-DD" date at local midnight (a bare ISO date would parse as UTC). */
export function parseDateStr(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00");
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** A day of the month, moved to the month's last day when the month is shorter (31 → 28 Feb). */
export function clampDayToMonth(year: number, monthIndex: number, day: number): number {
  return Math.min(day, daysInMonth(year, monthIndex));
}

/** The day pay lands in a given month — paydays on the 29th–31st fall on the last day of shorter months. */
export function paydayIn(year: number, monthIndex: number, paydayOfMonth: number): number {
  return clampDayToMonth(year, monthIndex, paydayOfMonth);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM" for a year and 0-based month index; out-of-range months roll over (-1 → previous December). */
export function toMonthKey(year: number, monthIndex: number): string {
  const d = new Date(year, monthIndex, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** Steps a "YYYY-MM" key by `n` months (negative goes back). */
export function addMonths(monthKey: string, n: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  return toMonthKey(y, m - 1 + n);
}

/** Returns a YYYY-MM-DD string for the given date with no time component. */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * The pay-period key ("YYYY-MM") a date belongs to. A period is keyed by the
 * month it starts in, so with payday on the 24th, 10 Oct belongs to "YYYY-09".
 */
export function getPeriodKey(date: Date | string, paydayOfMonth = 1): string {
  const d = typeof date === "string" ? parseDateStr(date) : date;
  const y = d.getFullYear();
  const m = d.getMonth();
  return d.getDate() >= paydayIn(y, m, paydayOfMonth) ? toMonthKey(y, m) : toMonthKey(y, m - 1);
}

export function getPeriodBounds(periodKey: string, paydayOfMonth = 1): { start: Date; end: Date } {
  const [year, month] = periodKey.split("-").map(Number);
  const start = new Date(year, month - 1, paydayIn(year, month - 1, paydayOfMonth));
  const end = new Date(year, month, paydayIn(year, month, paydayOfMonth));
  end.setMilliseconds(-1);
  return { start, end };
}

/** First and last day of a pay period as "YYYY-MM-DD", for cheap string comparisons. */
export interface DateRange {
  from: string;
  to: string;
}

export function getPeriodRange(periodKey: string, paydayOfMonth = 1): DateRange {
  const { start, end } = getPeriodBounds(periodKey, paydayOfMonth);
  return { from: toDateStr(start), to: toDateStr(end) };
}

/** True when a "YYYY-MM-DD" date falls inside the range (inclusive). ISO dates sort as strings. */
export function inRange(dateStr: string, range: DateRange): boolean {
  return dateStr >= range.from && dateStr <= range.to;
}

/**
 * Days from `now` until payday, counting today — "15 days left" on the 9th when
 * payday is the 24th. Safe to spend, the bills list and the projection all use
 * this so they never disagree about how much of the period remains.
 */
export function daysToPayday(periodKey: string, paydayOfMonth: number, now: Date): number {
  const { end } = getPeriodBounds(periodKey, paydayOfMonth);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY));
}

export function getCurrentPeriodKey(paydayOfMonth = 1): string {
  return getPeriodKey(new Date(), paydayOfMonth);
}

/**
 * Every pay-period key overlapping the date span `[from, to]`, in order. Used to
 * generate recurring bills across an arbitrary range. Returns [] when `from` is
 * after `to`.
 */
export function periodKeysBetween(from: Date, to: Date, paydayOfMonth = 1): string[] {
  const endKey = getPeriodKey(to, paydayOfMonth);
  const keys: string[] = [];
  // Capped so a bad range can never spin forever.
  for (let key = getPeriodKey(from, paydayOfMonth); key <= endKey && keys.length < 1200; key = addMonths(key, 1)) {
    keys.push(key);
  }
  return keys;
}
