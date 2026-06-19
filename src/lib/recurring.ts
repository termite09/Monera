import { Transaction, RecurringPayment } from "@/types";
import { getPeriodBounds, generateId, periodKeysBetween } from "@/lib/utils";

function clampDay(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay));
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Expands configured recurring payments into synthetic expense transactions
 * for a given budget period. These are paid outside Revolut (from another bank)
 * so they never appear in the CSV — we generate one occurrence per period.
 */
export function getRecurringTransactions(
  recurring: RecurringPayment[],
  monthKey: string,
  paydayOfMonth = 1,
  currency = "EUR"
): Transaction[] {
  const { start, end } = getPeriodBounds(monthKey, paydayOfMonth);
  const txs: Transaction[] = [];

  for (const r of recurring) {
    if (!r.amount || r.amount <= 0) continue;
    if (r.startMonth && monthKey < r.startMonth) continue;
    if (r.endMonth && monthKey > r.endMonth) continue;

    // A budget period can span two calendar months; try the occurrence in each.
    const candidates = [
      clampDay(start.getFullYear(), start.getMonth(), r.dayOfMonth),
      clampDay(end.getFullYear(), end.getMonth(), r.dayOfMonth),
    ];
    const occurrence = candidates.find((d) => d >= start && d <= end);
    if (!occurrence) continue;

    txs.push({
      id: generateId(`recurring-${r.id}-${monthKey}`),
      date: toDateStr(occurrence),
      description: r.name,
      amount: r.amount,
      type: "expense",
      currency: currency,
      category: r.category,
      source: "recurring",
      categorySource: "manual",
    });
  }

  return txs;
}

/**
 * Recurring occurrences across an arbitrary date span — generated per payday
 * period the span overlaps, then clamped to `[from, to]` (inclusive, date-only)
 * and de-duped by id. Used by the transactions page (custom range + cross-period
 * search) and the year overview, so recurring bills appear consistently
 * wherever spending is shown over more than one period.
 */
export function getRecurringInRange(
  recurring: RecurringPayment[],
  from: Date,
  to: Date,
  paydayOfMonth = 1,
  currency = "EUR"
): Transaction[] {
  const fromStr = toDateStr(from);
  const toStr = toDateStr(to);
  const seen = new Set<string>();
  const out: Transaction[] = [];

  for (const key of periodKeysBetween(from, to, paydayOfMonth)) {
    for (const t of getRecurringTransactions(recurring, key, paydayOfMonth, currency)) {
      if (t.date < fromStr || t.date > toStr) continue;
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
  }

  return out;
}
