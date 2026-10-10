import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Category } from "@/types";

export const MS_PER_DAY = 86_400_000;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: "€", GBP: "£", USD: "$" };
const SYMBOL_CODES: Record<string, string> = { "€": "EUR", "£": "GBP", "$": "USD" };

/** Turns an ISO code ("GBP") into its symbol ("£"); symbols pass through unchanged. */
export function currencySymbol(currency: string): string {
  if (CURRENCY_SYMBOLS[currency]) return CURRENCY_SYMBOLS[currency];
  return /^[A-Z]{3}$/.test(currency) ? `${currency} ` : currency;
}

/** Turns a symbol ("€") into its ISO code ("EUR"); codes pass through unchanged. */
export function currencyCode(currency: string): string {
  return SYMBOL_CODES[currency.trim()] ?? currency;
}

// The currency every amount is shown in. Set by AppDataProvider from the user's
// statements, so formatCurrency() call sites don't each need it threaded through.
// Only ever changed in the browser, so the server's copy can't leak between users.
let displayCurrency = "€";

export function setDisplayCurrency(currency: string): void {
  if (typeof window === "undefined") return;
  displayCurrency = currencySymbol(currency);
}

export function getDisplayCurrency(): string {
  return displayCurrency;
}

/** The most common currency across imported statement rows, or null if none. */
export function dominantCurrency(transactions: { currency: string; source: string }[]): string | null {
  const counts = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.source === "recurring" || !tx.currency) continue;
    const code = currencyCode(tx.currency);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [c, n] of counts) if (n > bestCount) { best = c; bestCount = n; }
  return best;
}

// Building an Intl formatter is the expensive part of formatting, so each one
// is created once and reused for every amount and date on screen.
const moneyFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dayMonthFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const dayMonthYearFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const monthYearShortFormat = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" });
const monthYearLongFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const monthShortFormat = new Intl.DateTimeFormat("en-GB", { month: "short" });
const weekdayShortFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const longDateFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

export function formatCurrency(amount: number, currency?: string): string {
  const symbol = currency ? currencySymbol(currency) : displayCurrency;
  return `${symbol}${moneyFormat.format(amount)}`;
}

// en-GB abbreviates September as "Sept"; every other month is three letters.
// One style everywhere: "7 Sep", "24 Sep – 23 Oct", "7 Sep 2025".
const evenMonth = (s: string) => s.replace("Sept", "Sep");

/** A "YYYY-MM-DD" date at local midnight (a bare ISO date would parse as UTC). */
export function parseDateStr(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00");
}

export function formatDate(dateStr: string): string {
  // Full ISO timestamps (e.g. Drive's createdTime) already carry a zone, so only
  // date-only strings are pinned to local midnight.
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  return evenMonth(dayMonthYearFormat.format(isDateOnly ? parseDateStr(dateStr) : new Date(dateStr)));
}

/** "7 Sep" */
export function formatShortDate(dateStr: string): string {
  return evenMonth(dayMonthFormat.format(parseDateStr(dateStr)));
}

/** "Sep 2025" (short) or "September 2025" (long) for a "YYYY-MM" key. */
export function formatMonthYear(monthKey: string, style: "short" | "long" = "short"): string {
  const [y, m] = monthKey.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  return style === "long" ? monthYearLongFormat.format(date) : evenMonth(monthYearShortFormat.format(date));
}

/** "Sep" */
export function formatMonthShort(dateStr: string): string {
  return evenMonth(monthShortFormat.format(parseDateStr(dateStr)));
}

/** "Mon 7 Sep" */
export function formatWeekdayDate(dateStr: string): string {
  return `${weekdayShortFormat.format(parseDateStr(dateStr))} ${formatShortDate(dateStr)}`;
}

/** "Monday 7 September" */
export function formatLongDate(date: Date): string {
  return longDateFormat.format(date);
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

export function getPeriodLabel(periodKey: string, paydayOfMonth = 1): string {
  if (paydayOfMonth <= 1) return formatMonthYear(periodKey, "long");
  const { start, end } = getPeriodBounds(periodKey, paydayOfMonth);
  const fmt = (d: Date) => evenMonth(dayMonthFormat.format(d));
  // Add the year only when it isn't this year, so stepping back across January
  // stays unambiguous without cluttering the everyday label.
  if (start.getFullYear() !== end.getFullYear()) {
    return `${fmt(start)} ${start.getFullYear()} – ${fmt(end)} ${end.getFullYear()}`;
  }
  const yearSuffix = end.getFullYear() === new Date().getFullYear() ? "" : ` ${end.getFullYear()}`;
  return `${fmt(start)} – ${fmt(end)}${yearSuffix}`;
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

export function generateId(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Stable id for a transaction within a single CSV file, disambiguating genuinely
 * identical rows (e.g. two €3.50 coffees on the same day) that would otherwise
 * collapse to one id and be lost during dedup. The FIRST occurrence keeps the
 * plain `generateId(baseKey)` so existing ids — and the overrides/exclusions
 * keyed by them — never change; only previously-dropped duplicates get new ids.
 */
export function occurrenceId(baseKey: string, counts: Map<string, number>): string {
  const n = counts.get(baseKey) ?? 0;
  counts.set(baseKey, n + 1);
  return generateId(n === 0 ? baseKey : `${baseKey}#${n}`);
}

/**
 * Category colour as a CSS value. Categories share one navy family told apart by
 * lightness; green/amber/red are reserved for budget status. Resolves through
 * theme tokens so it follows dark mode (works for SVG strokes and inline styles).
 */
const CATEGORY_COLORS: Record<Category, string> = {
  Needs: "var(--cat-needs)",
  Wants: "var(--cat-wants)",
  Savings: "var(--cat-savings)",
  Uncategorized: "var(--muted-foreground)",
};

export function getCategoryColor(category: Category): string {
  return CATEGORY_COLORS[category];
}

const CATEGORY_SWATCHES: Record<Category, string> = {
  Needs: "bg-cat-needs",
  Wants: "bg-cat-wants",
  Savings: "bg-cat-savings",
  Uncategorized: "bg-muted-foreground/40",
};

/** Background class for a category swatch (always shown next to its label). */
export function getCategorySwatchClass(category: Category): string {
  return CATEGORY_SWATCHES[category];
}

/**
 * Text class for a category label. Labels stay in readable ink — the swatch
 * carries the category colour — so Wants never reads as a warning.
 */
export function getCategoryTextClass(category: Category): string {
  return category === "Uncategorized" ? "text-muted-foreground" : "text-foreground";
}

/**
 * Rounds a monetary amount to clean cents, eliminating floating-point
 * accumulation drift (e.g. 0.1 + 0.2 → 0.3, not 0.30000000000000004). Use at
 * aggregation boundaries so totals and budget comparisons don't read as off by a
 * sub-cent epsilon.
 */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function cleanDescription(description: string): string {
  return description.replace(/•/g, "").replace(/\s+/g, " ").trim();
}

export function ordinal(n: number): string {
  if (n % 10 === 1 && n !== 11) return `${n}st`;
  if (n % 10 === 2 && n !== 12) return `${n}nd`;
  if (n % 10 === 3 && n !== 13) return `${n}rd`;
  return `${n}th`;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
