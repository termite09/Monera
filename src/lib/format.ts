/** Money, dates and periods as people read them. */

import { getPeriodBounds, parseDateStr, toDateStr } from "@/lib/periods";

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

/** "September 2025" with payday on the 1st, otherwise "24 Sep – 23 Oct". */
export function getPeriodLabel(periodKey: string, paydayOfMonth = 1): string {
  if (paydayOfMonth <= 1) return formatMonthYear(periodKey, "long");
  const { start, end } = getPeriodBounds(periodKey, paydayOfMonth);
  const fmt = (d: Date) => formatShortDate(toDateStr(d));
  // Add the year only when it isn't this year, so stepping back across January
  // stays unambiguous without cluttering the everyday label.
  if (start.getFullYear() !== end.getFullYear()) {
    return `${fmt(start)} ${start.getFullYear()} – ${fmt(end)} ${end.getFullYear()}`;
  }
  const yearSuffix = end.getFullYear() === new Date().getFullYear() ? "" : ` ${end.getFullYear()}`;
  return `${fmt(start)} – ${fmt(end)}${yearSuffix}`;
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
