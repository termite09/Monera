import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
 * Rounds a monetary amount to clean cents, eliminating floating-point
 * accumulation drift (e.g. 0.1 + 0.2 → 0.3, not 0.30000000000000004). Use at
 * aggregation boundaries so totals and budget comparisons don't read as off by a
 * sub-cent epsilon.
 */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** `list` with `item` added, unless it's already there — so a double tap or another device can't add it twice. */
export function addOnce(list: string[] | undefined, item: string): string[] {
  return list?.includes(item) ? list : [...(list ?? []), item];
}
