import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Category } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "€"): string {
  return `${currency}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function getMonthKey(date: Date | string, paydayOfMonth = 1): string {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  if (paydayOfMonth <= 1) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (d.getDate() >= paydayOfMonth) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

export function getPeriodBounds(monthKey: string, paydayOfMonth = 1): { start: Date; end: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(year, month - 1, paydayOfMonth);
  const end = new Date(year, month, paydayOfMonth);
  end.setMilliseconds(-1);
  return { start, end };
}

export function getMonthLabel(monthKey: string, paydayOfMonth = 1): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (paydayOfMonth <= 1) {
    return new Date(year, month - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }
  const start = new Date(year, month - 1, paydayOfMonth);
  const end = new Date(year, month, paydayOfMonth - 1);
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
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

export function getCategoryColor(category: Category): string {
  const colors: Record<Category, string> = {
    Needs: "#1E3A5F",
    Wants: "#D97706",
    Savings: "#059669",
    Uncategorized: "#6B7280",
  };
  return colors[category];
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
