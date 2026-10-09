import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Category } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: "€", GBP: "£", USD: "$" };

/** Turns an ISO code ("GBP") into its symbol ("£"); symbols pass through unchanged. */
export function currencySymbol(currency: string): string {
  if (CURRENCY_SYMBOLS[currency]) return CURRENCY_SYMBOLS[currency];
  return /^[A-Z]{3}$/.test(currency) ? `${currency} ` : currency;
}

// The currency every amount is shown in. Set once per render by AppDataProvider
// from the user's statements, so formatCurrency() call sites don't each need it
// threaded through.
let displayCurrency = "€";

export function setDisplayCurrency(currency: string): void {
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
    counts.set(tx.currency, (counts.get(tx.currency) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [c, n] of counts) if (n > bestCount) { best = c; bestCount = n; }
  return best;
}

export function formatCurrency(amount: number, currency?: string): string {
  const symbol = currency ? currencySymbol(currency) : displayCurrency;
  return `${symbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// en-GB abbreviates September as "Sept"; every other month is three letters.
// One style everywhere: "7 Sep", "24 Sep – 23 Oct", "7 Sep 2025".
const evenMonth = (s: string) => s.replace("Sept", "Sep");

export function formatDate(dateStr: string): string {
  // Date-only strings ("YYYY-MM-DD") must be pinned to local midnight, otherwise
  // they parse as UTC and render a day early in negative-offset timezones. Full
  // ISO timestamps (e.g. Drive's createdTime) already carry a zone, so pass through.
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  const date = new Date(isDateOnly ? dateStr + "T00:00:00" : dateStr);
  return evenMonth(date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }));
}

export function formatShortDate(dateStr: string): string {
  return evenMonth(new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }));
}

/**
 * The day pay lands in a given month. Paydays on the 29th–31st fall on the
 * month's last day when the month is shorter (e.g. the 31st → 28 Feb).
 */
export function paydayIn(year: number, monthIndex: number, paydayOfMonth: number): number {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(paydayOfMonth, daysInMonth);
}

export function getMonthKey(date: Date | string, paydayOfMonth = 1): string {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  if (paydayOfMonth <= 1) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (d.getDate() >= paydayIn(d.getFullYear(), d.getMonth(), paydayOfMonth)) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

export function getPeriodBounds(monthKey: string, paydayOfMonth = 1): { start: Date; end: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(year, month - 1, paydayIn(year, month - 1, paydayOfMonth));
  const end = new Date(year, month, paydayIn(year, month, paydayOfMonth));
  end.setMilliseconds(-1);
  return { start, end };
}

/**
 * Days from `now` until payday, counting today — "15 days left" on the 9th when
 * payday is the 24th. Safe to spend and the "By payday" projection share this so
 * they never disagree about how much of the period remains.
 */
export function daysToPayday(monthKey: string, paydayOfMonth: number, now: Date): number {
  const { end } = getPeriodBounds(monthKey, paydayOfMonth);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY));
}

export function getMonthLabel(monthKey: string, paydayOfMonth = 1): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (paydayOfMonth <= 1) {
    return new Date(year, month - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }
  const { start, end } = getPeriodBounds(monthKey, paydayOfMonth);
  const fmt = (d: Date) => evenMonth(d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }));
  // Add the year only when it isn't this year, so stepping back across January
  // stays unambiguous without cluttering the everyday label.
  if (start.getFullYear() !== end.getFullYear()) {
    return `${fmt(start)} ${start.getFullYear()} – ${fmt(end)} ${end.getFullYear()}`;
  }
  const yearSuffix = end.getFullYear() === new Date().getFullYear() ? "" : ` ${end.getFullYear()}`;
  return `${fmt(start)} – ${fmt(end)}${yearSuffix}`;
}

export function getCurrentMonth(paydayOfMonth = 1): string {
  return getMonthKey(new Date(), paydayOfMonth);
}

/**
 * Every payday-period key (`YYYY-MM`) overlapping the date span `[from, to]`,
 * in chronological order. Used to generate recurring bills across an arbitrary
 * range. Returns [] when `from` is after `to`.
 */
export function periodKeysBetween(from: Date, to: Date, paydayOfMonth = 1): string[] {
  const startKey = getMonthKey(from, paydayOfMonth);
  const endKey = getMonthKey(to, paydayOfMonth);
  if (startKey > endKey) return [];

  const keys: string[] = [];
  let [y, m] = startKey.split("-").map(Number); // m is 1-based
  // Cap defensively so a bad range can never spin forever.
  for (let i = 0; i < 1200; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    keys.push(key);
    if (key === endKey) break;
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return keys;
}

export function generateId(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
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
export function getCategoryColor(category: Category): string {
  const colors: Record<Category, string> = {
    Needs: "var(--cat-needs)",
    Wants: "var(--cat-wants)",
    Savings: "var(--cat-savings)",
    Uncategorized: "var(--muted-foreground)",
  };
  return colors[category];
}

/** Background class for a category swatch (always shown next to its label). */
export function getCategorySwatchClass(category: string): string {
  const classes: Record<string, string> = {
    Needs: "bg-cat-needs",
    Wants: "bg-cat-wants",
    Savings: "bg-cat-savings",
    Uncategorized: "bg-muted-foreground/40",
  };
  return classes[category] ?? "bg-muted-foreground/40";
}

/**
 * Text class for a category label. Labels stay in readable ink — the swatch
 * carries the category colour — so Wants never reads as a warning.
 */
export function getCategoryTextClass(category: string): string {
  return category === "Uncategorized" || !["Needs", "Wants", "Savings"].includes(category)
    ? "text-muted-foreground"
    : "text-foreground";
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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

export function getPrevMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Returns a YYYY-MM-DD string for the given date with no time component. */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const MS_PER_DAY = 86_400_000;
