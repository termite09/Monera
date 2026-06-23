import { Transaction, Category } from "@/types";
import { getPeriodBounds, cleanDescription, getPrevMonthKey, roundMoney } from "@/lib/utils";
import { getPeriodSpend } from "@/lib/finance";

export interface MonthlyTotals {
  needs: number;
  wants: number;
  savings: number;
}

/**
 * Per-period expense totals for each of the 12 budget periods in a year, bucketed
 * by the payday-aware period key (not the calendar month). Index 0 = the period
 * keyed `${year}-01`. Used by the year overview chart; replaces the old reliance
 * on a stored `tx.month` field that was computed with an inconsistent payday.
 */
export function monthlyCategoryTotals(
  transactions: Transaction[],
  year: number,
  paydayOfMonth = 1
): MonthlyTotals[] {
  return Array.from({ length: 12 }, (_, i) => {
    const monthKey = `${year}-${String(i + 1).padStart(2, "0")}`;
    const { byCategory } = getPeriodSpend(transactions, monthKey, paydayOfMonth);
    return {
      needs: byCategory.Needs,
      wants: byCategory.Wants,
      savings: byCategory.Savings,
    };
  });
}

export interface MerchantStat {
  name: string;
  total: number;
  count: number;
}

export interface CategoryStat {
  category: Category;
  total: number;
  pct: number;
}

export interface ReportData {
  totalSpent: number;
  txCount: number;
  avgPerDay: number;
  avgPerTx: number;
  daysElapsed: number;
  projectedTotal: number;
  prevTotal: number;
  prevByCategory: Record<Category, number>;
  changePct: number | null;
  topMerchants: MerchantStat[];
  frequentMerchants: MerchantStat[];
  biggest: Transaction[];
  byCategory: CategoryStat[];
}

// Collapse a raw description into a stable merchant key. Revolut descriptions
// are mostly clean merchant names, but we lowercase + squash whitespace and
// strip trailing reference numbers so "Wolt" and "Wolt  123" group together.
function merchantKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[#*]?\d{4,}.*$/, "")
    .trim();
}

function displayName(description: string): string {
  return cleanDescription(description);
}

function periodExpenses(
  transactions: Transaction[],
  monthKey: string,
  paydayOfMonth: number
): Transaction[] {
  const { start, end } = getPeriodBounds(monthKey, paydayOfMonth);
  return transactions.filter((t) => {
    if (t.excluded || t.type !== "expense") return false;
    const d = new Date(t.date + "T00:00:00");
    return d >= start && d <= end;
  });
}


export interface Subscription {
  name: string;
  amount: number; // representative (median) charge
  total: number;  // sum of all detected charges
  months: number; // distinct calendar months the charge was seen in
  lastDate: string;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Surfaces likely subscriptions from transaction history: a merchant charged a
 * consistent amount across two or more distinct months. Variable spending (e.g.
 * groceries) is excluded because its amounts don't cluster. Operates on all
 * history, independent of the selected period.
 */
export function detectSubscriptions(transactions: Transaction[]): Subscription[] {
  const groups = new Map<string, { name: string; amounts: number[]; months: Set<string>; dates: string[]; lastDate: string }>();

  for (const t of transactions) {
    if (t.excluded || t.type !== "expense") continue;
    const key = merchantKey(t.description) || "other";
    const g = groups.get(key);
    const mk = t.date.slice(0, 7);
    if (g) {
      g.amounts.push(t.amount);
      g.months.add(mk);
      g.dates.push(t.date);
      if (t.date > g.lastDate) g.lastDate = t.date;
    } else {
      groups.set(key, {
        name: displayName(t.description),
        amounts: [t.amount],
        months: new Set([mk]),
        dates: [t.date],
        lastDate: t.date,
      });
    }
  }

  const subs: Subscription[] = [];
  for (const g of groups.values()) {
    // Require strong evidence: 3+ distinct months and 3+ charges
    if (g.months.size < 3 || g.amounts.length < 3) continue;

    // Round the amount median to clean cents: it is both the displayed
    // representative charge and the basis for the tolerance check, so it must
    // not carry sub-cent float drift (e.g. (12.99+13.49)/2 = 13.2399…).
    const mid = roundMoney(median(g.amounts));
    // Treat the charge as recurring only if every amount is close to the median
    // (small price changes are tolerated; variable spend is not).
    const tolerance = Math.max(1, mid * 0.15);
    const consistent = g.amounts.every((a) => Math.abs(a - mid) <= tolerance);
    if (!consistent) continue;

    // Interval check: gaps between consecutive charges must be monthly or bi-monthly
    const sortedDates = [...g.dates].sort();
    const intervals: number[] = [];
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1] + "T00:00:00");
      const curr = new Date(sortedDates[i] + "T00:00:00");
      intervals.push(Math.round((curr.getTime() - prev.getTime()) / 86400000));
    }
    const medianInterval = median(intervals);
    // Accept monthly (20–35 days) or bi-monthly (36–65 days)
    if (medianInterval < 20 || medianInterval > 65) continue;
    const intervalConsistent = intervals.every((iv) => Math.abs(iv - medianInterval) <= medianInterval * 0.5);
    if (!intervalConsistent) continue;

    const rawTotal = g.amounts.reduce((s, a) => s + a, 0);
    const total = Math.round(rawTotal * 100) / 100;
    subs.push({ name: g.name, amount: mid, total, months: g.months.size, lastDate: g.lastDate });
  }

  return subs.sort((a, b) => b.months - a.months || b.amount - a.amount);
}

export function buildReport(
  transactions: Transaction[],
  monthKey: string,
  paydayOfMonth: number
): ReportData {
  const expenses = periodExpenses(transactions, monthKey, paydayOfMonth);

  // Headline spend + category split come from the shared period-spend helper so
  // they net refunds identically to the dashboard. The gross `expenses` list is
  // still used below for merchant grouping and biggest-purchase rankings (which
  // are per-transaction views, not netted totals).
  const spend = getPeriodSpend(transactions, monthKey, paydayOfMonth);
  const prevSpend = getPeriodSpend(transactions, getPrevMonthKey(monthKey), paydayOfMonth);
  const totalSpent = spend.total;
  const prevTotal = prevSpend.total;

  // Group by merchant
  const groups = new Map<string, MerchantStat>();
  for (const t of expenses) {
    const key = merchantKey(t.description) || "other";
    const existing = groups.get(key);
    if (existing) {
      existing.total += t.amount;
      existing.count += 1;
    } else {
      groups.set(key, { name: displayName(t.description), total: t.amount, count: 1 });
    }
  }
  const merchants = [...groups.values()];

  const topMerchants = [...merchants].sort((a, b) => b.total - a.total).slice(0, 6);
  const frequentMerchants = [...merchants]
    .filter((m) => m.count > 1)
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .slice(0, 6);
  const biggest = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5);

  // Category breakdown — netted per category (matches the dashboard donuts).
  const cats: Category[] = ["Needs", "Wants", "Savings", "Uncategorized"];
  const byCategory: CategoryStat[] = cats
    .map((category) => {
      const total = spend.byCategory[category];
      return { category, total, pct: totalSpent > 0 ? (total / totalSpent) * 100 : 0 };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  // Pace metrics — how far into the period we are
  const { start, end } = getPeriodBounds(monthKey, paydayOfMonth);
  const now = new Date();
  const periodMs = end.getTime() - start.getTime();
  const totalDays = Math.max(1, Math.round(periodMs / 86400000));
  const elapsedMs = Math.min(Math.max(now.getTime() - start.getTime(), 0), periodMs);
  const daysElapsed = Math.max(1, Math.min(totalDays, Math.ceil(elapsedMs / 86400000)));

  const avgPerDay = totalSpent / daysElapsed;
  const avgPerTx = expenses.length > 0 ? totalSpent / expenses.length : 0;
  const projectedTotal = avgPerDay * totalDays;

  const changePct = prevTotal > 0 ? ((totalSpent - prevTotal) / prevTotal) * 100 : null;

  return {
    totalSpent,
    txCount: expenses.length,
    avgPerDay,
    avgPerTx,
    daysElapsed,
    projectedTotal,
    prevTotal,
    prevByCategory: prevSpend.byCategory,
    changePct,
    topMerchants,
    frequentMerchants,
    biggest,
    byCategory,
  };
}
