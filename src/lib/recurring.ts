import { Transaction, RecurringPayment } from "@/types";
import { getPeriodBounds, getPeriodKey, getPeriodRange, parseDateStr, periodKeysBetween, toDateStr, clampDayToMonth } from "@/lib/periods";
import { formatMonthYear } from "@/lib/format";
import { generateId } from "@/lib/utils";

/**
 * Expands configured recurring payments into synthetic expense transactions
 * for a given budget period. These are paid outside the imported account (from
 * another bank) so they never appear in a statement — we generate one occurrence
 * per period.
 */
export function getRecurringTransactions(
  recurring: RecurringPayment[],
  periodKey: string,
  paydayOfMonth = 1,
  currency = "EUR"
): Transaction[] {
  const { start, end } = getPeriodBounds(periodKey, paydayOfMonth);
  const onDay = (month: Date, day: number) =>
    new Date(month.getFullYear(), month.getMonth(), clampDayToMonth(month.getFullYear(), month.getMonth(), day));
  const txs: Transaction[] = [];

  for (const r of recurring) {
    if (!r.amount || r.amount <= 0) continue;
    if (r.startMonth && periodKey < r.startMonth) continue;
    if (r.endMonth && periodKey > r.endMonth) continue;

    // A budget period can span two calendar months; try the occurrence in each.
    const occurrence = [onDay(start, r.dayOfMonth), onDay(end, r.dayOfMonth)].find((d) => d >= start && d <= end);
    if (!occurrence) continue;

    txs.push({
      id: generateId(`recurring-${r.id}-${periodKey}`),
      date: toDateStr(occurrence),
      description: r.name,
      amount: r.amount,
      type: "expense",
      currency,
      category: r.category,
      source: "recurring",
      categorySource: "manual",
      excluded: false,
      billId: r.id,
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
      if (t.date < fromStr || t.date > toStr || seen.has(t.id)) continue;
      seen.add(t.id);
      out.push(t);
    }
  }

  return out;
}

/**
 * The day regular bills start counting: the start of the pay period holding the
 * first transaction Monera has, or of today's period when there are none yet.
 * Before that Monera knows nothing about the user's money, so it mustn't invent
 * spending from their bills.
 */
export function billsStartDate(transactions: Transaction[], paydayOfMonth: number, today: string): string {
  const first = transactions.reduce((min, t) => (t.source !== "recurring" && t.date < min ? t.date : min), today);
  return getPeriodRange(getPeriodKey(first, paydayOfMonth), paydayOfMonth).from;
}

/** The bills falling between `from` and `to` ("YYYY-MM-DD", inclusive), never before `start`. */
export function billsBetween(
  recurring: RecurringPayment[],
  from: string,
  to: string,
  start: string,
  paydayOfMonth: number,
  currency: string
): Transaction[] {
  const first = from > start ? from : start;
  if (first > to) return [];
  return getRecurringInRange(recurring, parseDateStr(first), parseDateStr(to), paydayOfMonth, currency);
}

/** "Sep 2025 – Mar 2026", "From Sep 2025", "Until Mar 2026", or null when a bill applies to every period. */
export function billPeriodLabel(r: Pick<RecurringPayment, "startMonth" | "endMonth">): string | null {
  if (r.startMonth && r.endMonth) return `${formatMonthYear(r.startMonth)} – ${formatMonthYear(r.endMonth)}`;
  if (r.startMonth) return `From ${formatMonthYear(r.startMonth)}`;
  if (r.endMonth) return `Until ${formatMonthYear(r.endMonth)}`;
  return null;
}
