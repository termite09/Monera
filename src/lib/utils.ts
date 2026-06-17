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
