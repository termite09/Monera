import { Transaction, Category } from "@/types";
import { getPeriodBounds, cleanDescription, getPrevMonthKey, roundMoney, MS_PER_DAY, daysToPayday } from "@/lib/utils";
import { getPeriodSpend, netExpenseByCategory } from "@/lib/finance";

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
      // Not-yet-sorted spending counts as Wants everywhere in Monera.
      wants: roundMoney(byCategory.Wants + byCategory.Uncategorized),
      savings: byCategory.Savings,
    };
  });
}

interface MerchantStat {
  name: string;
  total: number;
  count: number;
}

interface CategoryStat {
  category: Category;
  total: number;
  pct: number;
}

interface ReportData {
  totalSpent: number;
  txCount: number;
  avgPerDay: number;
  avgPerTx: number;
  daysElapsed: number;
  /** Spending (savings excluded) you'll have reached by payday at this pace. */
  projectedTotal: number;
  prevTotal: number;
  prevByCategory: Record<Category, number>;
  /** True when "prev" covers last period only up to the same day as today. */
  comparedToSamePoint: boolean;
  /** Everyday spending still to come before payday at the current pace (bills excluded). */
  projectedPace: number;
  /** Spending excluding savings — what "spent" means everywhere in Monera. */
  spending: number;
  prevSpending: number;
  changePct: number | null;
  topMerchants: MerchantStat[];
  frequentMerchants: MerchantStat[];
  biggest: Transaction[];
  byCategory: CategoryStat[];
}

// Collapse a raw description into a stable merchant key. Revolut descriptions
// are mostly clean merchant names, but we lowercase + squash whitespace and
// strip trailing reference numbers so "Wolt" and "Wolt  123" group together.
export function merchantKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[#*]?\d{4,}.*$/, "")
    .trim();
}

export function displayName(description: string): string {
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
  // Subscriptions are optional spending (streaming, gym, apps). Rent, fuel and
  // savings transfers repeat too, but they aren't subscriptions.
  return detectRecurring(transactions.filter((t) => t.category === "Wants")).map(({ sub }) => sub);
}

/** Merchants charged a consistent amount on a monthly rhythm, whatever their category. */
function detectRecurring(transactions: Transaction[]): { key: string; sub: Subscription }[] {
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

  const subs: { key: string; sub: Subscription }[] = [];
  for (const [key, g] of groups) {
    // Require strong evidence: 3+ distinct months and 3+ charges
    if (g.months.size < 3 || g.amounts.length < 3) continue;

    // Round the amount median to clean cents: it is both the displayed
    // representative charge and the basis for the tolerance check, so it must
    // not carry sub-cent float drift (e.g. (12.99+13.49)/2 = 13.2399…).
    const mid = roundMoney(median(g.amounts));
    // A subscription charges the same price, or switches once to a new price
    // (12.99 → 13.99). Shopping at the same shop varies every time, so: at most
    // two distinct prices within 15% of the median, or every charge within 3%.
    const distinct = new Set(g.amounts.map((a) => roundMoney(a))).size;
    const within = (pct: number) => g.amounts.every((a) => Math.abs(a - mid) <= Math.max(0.5, mid * pct));
    const consistent = (distinct <= 2 && within(0.15)) || within(0.03);
    if (!consistent) continue;

    // Interval check: gaps between consecutive charges must be monthly or bi-monthly
    const sortedDates = [...g.dates].sort();
    const intervals: number[] = [];
    for (let i = 1; i < sortedDates.length; i++) {
      const prev = new Date(sortedDates[i - 1] + "T00:00:00");
      const curr = new Date(sortedDates[i] + "T00:00:00");
      intervals.push(Math.round((curr.getTime() - prev.getTime()) / MS_PER_DAY));
    }
    const medianInterval = median(intervals);
    // Accept monthly (20–35 days) or bi-monthly (36–65 days)
    if (medianInterval < 20 || medianInterval > 65) continue;
    const intervalConsistent = intervals.every((iv) => Math.abs(iv - medianInterval) <= medianInterval * 0.5);
    if (!intervalConsistent) continue;

    const rawTotal = g.amounts.reduce((s, a) => s + a, 0);
    const total = roundMoney(rawTotal);
    subs.push({ key, sub: { name: g.name, amount: mid, total, months: g.months.size, lastDate: g.lastDate } });
  }

  return subs.sort((a, b) => b.sub.months - a.sub.months || b.sub.amount - a.sub.amount);
}

export function buildReport(
  transactions: Transaction[],
  monthKey: string,
  paydayOfMonth: number,
  now: Date = new Date(),
  /** Known spending still to come before payday (bills, expected subscriptions). */
  upcomingSpend = 0
): ReportData {
  const expenses = periodExpenses(transactions, monthKey, paydayOfMonth);

  // Headline spend + category split come from the shared period-spend helper so
  // they net refunds identically to the dashboard. The gross `expenses` list is
  // still used below for merchant grouping and biggest-purchase rankings (which
  // are per-transaction views, not netted totals).
  const spend = getPeriodSpend(transactions, monthKey, paydayOfMonth);
  const totalSpent = spend.total;

  // Compare like with like: while a period is still running, set it against last
  // period only up to the same day, not against last period's full total.
  const { start, end } = getPeriodBounds(monthKey, paydayOfMonth);
  const comparedToSamePoint = now >= start && now <= end;
  let prevByCategory: Record<Category, number>;
  if (comparedToSamePoint) {
    const { start: prevStart } = getPeriodBounds(getPrevMonthKey(monthKey), paydayOfMonth);
    const cutoff = new Date(prevStart.getTime() + (now.getTime() - start.getTime()));
    prevByCategory = netExpenseByCategory(
      transactions.filter((t) => {
        const d = new Date(t.date + "T00:00:00");
        return d >= prevStart && d <= cutoff;
      })
    );
  } else {
    prevByCategory = getPeriodSpend(transactions, getPrevMonthKey(monthKey), paydayOfMonth).byCategory;
  }
  const prevTotal = roundMoney(Object.values(prevByCategory).reduce((s, v) => s + v, 0));

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
  const periodMs = end.getTime() - start.getTime();
  const totalDays = Math.max(1, Math.round(periodMs / MS_PER_DAY));
  const elapsedMs = Math.min(Math.max(now.getTime() - start.getTime(), 0), periodMs);
  const daysElapsed = Math.max(1, Math.min(totalDays, Math.ceil(elapsedMs / MS_PER_DAY)));

  const avgPerDay = totalSpent / daysElapsed;
  const avgPerTx = expenses.length > 0 ? totalSpent / expenses.length : 0;

  // Projection: only day-to-day spending carries on at the current pace. Rent and
  // other regular charges happen once a period, and savings aren't spending, so
  // extrapolating them (a day-1 rent payment × 30) wildly overstates the total.
  const recurringKeys = new Set(detectRecurring(transactions).map(({ key }) => key));
  const dayToDay = netExpenseByCategory(
    expenses.filter((t) => t.category !== "Savings" && t.source !== "recurring" && !recurringKeys.has(merchantKey(t.description) || "other"))
  );
  const variableSoFar = dayToDay.Needs + dayToDay.Wants + dayToDay.Uncategorized;
  const spentSoFar = totalSpent - spend.byCategory.Savings;
  // Days still to come after today (today's spending is already in the figures).
  const daysLeft = comparedToSamePoint ? Math.max(0, daysToPayday(monthKey, paydayOfMonth, now) - 1) : 0;
  const projectedTotal = comparedToSamePoint
    ? roundMoney(spentSoFar + (variableSoFar / daysElapsed) * daysLeft + upcomingSpend)
    : roundMoney(spentSoFar);

  const changePct = prevTotal > 0 ? ((totalSpent - prevTotal) / prevTotal) * 100 : null;

  return {
    totalSpent,
    txCount: expenses.length,
    avgPerDay,
    avgPerTx,
    daysElapsed,
    projectedTotal,
    prevTotal,
    prevByCategory,
    comparedToSamePoint,
    projectedPace: comparedToSamePoint ? roundMoney((variableSoFar / daysElapsed) * daysLeft) : 0,
    spending: roundMoney(spentSoFar),
    prevSpending: roundMoney(prevTotal - prevByCategory.Savings),
    changePct,
    topMerchants,
    frequentMerchants,
    biggest,
    byCategory,
  };
}
