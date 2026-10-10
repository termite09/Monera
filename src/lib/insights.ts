import { Transaction, Category } from "@/types";
import {
  addMonths, clampDayToMonth, cleanDescription, getPeriodBounds, getPeriodKey, getPeriodRange, inRange,
  parseDateStr, roundMoney, toDateStr, MS_PER_DAY,
} from "@/lib/utils";
import { getPeriodSpend, netExpenseByCategory } from "@/lib/finance";

export interface CategoryTotals {
  needs: number;
  wants: number;
  savings: number;
}

/**
 * Net spending by category for each of the 12 pay periods keyed in `year`
 * (index 0 = the period keyed `${year}-01`). Not-yet-sorted spending counts as
 * Wants, as everywhere in Monera. One pass to bucket, then the shared netting.
 */
export function periodTotalsForYear(transactions: Transaction[], year: number, paydayOfMonth = 1): CategoryTotals[] {
  const yearRange = { from: getPeriodRange(`${year}-01`, paydayOfMonth).from, to: getPeriodRange(`${year}-12`, paydayOfMonth).to };
  const buckets: Transaction[][] = Array.from({ length: 12 }, () => []);
  for (const tx of transactions) {
    if (!inRange(tx.date, yearRange)) continue;
    const month = Number(getPeriodKey(tx.date, paydayOfMonth).slice(5, 7));
    buckets[month - 1].push(tx);
  }
  return buckets.map((txs) => {
    const b = netExpenseByCategory(txs);
    return { needs: b.Needs, wants: roundMoney(b.Wants + b.Uncategorized), savings: b.Savings };
  });
}

// Collapse a raw description into a stable merchant key. Revolut descriptions
// are mostly clean merchant names, but we lowercase + squash whitespace and
// strip trailing reference numbers so "Wolt" and "Wolt  123" group together.
export function merchantKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[#*]?\d{4,}.*$/, "")
    .trim() || "other";
}

export interface MerchantGroup {
  key: string;
  name: string;
  total: number;
  count: number;
  /** Newest first. */
  transactions: Transaction[];
}

/** Transactions grouped by merchant, biggest total first. */
export function groupByMerchant(transactions: Transaction[]): MerchantGroup[] {
  const groups = new Map<string, MerchantGroup>();
  for (const tx of transactions) {
    const key = merchantKey(tx.description);
    const group = groups.get(key) ?? { key, name: cleanDescription(tx.description), total: 0, count: 0, transactions: [] };
    group.total += tx.amount;
    group.count += 1;
    group.transactions.push(tx);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, total: roundMoney(g.total), transactions: g.transactions.sort((a, b) => b.date.localeCompare(a.date)) }))
    .sort((a, b) => b.total - a.total);
}

export interface Subscription {
  /** merchantKey of the charges, for finding them again. */
  key: string;
  name: string;
  /** Representative (median) charge. */
  amount: number;
  /** Sum of all detected charges. */
  total: number;
  /** Distinct calendar months the charge was seen in. */
  months: number;
  lastDate: string;
  /** Charged every month (1) or every other month (2). */
  everyMonths: 1 | 2;
}

/** What a subscription costs per month, whatever its billing rhythm. */
export function monthlyCost(sub: Subscription): number {
  return sub.amount / sub.everyMonths;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Surfaces likely subscriptions from transaction history: an optional-spending
 * (Wants) merchant charged a consistent amount on a monthly or bi-monthly rhythm.
 * Rent, fuel and savings transfers repeat too, but they aren't subscriptions.
 * Operates on all history, independent of the selected period.
 */
export function detectSubscriptions(transactions: Transaction[]): Subscription[] {
  const groups = new Map<string, { name: string; amounts: number[]; months: Set<string>; dates: string[] }>();
  for (const t of transactions) {
    if (t.excluded || t.type !== "expense" || t.category !== "Wants") continue;
    const key = merchantKey(t.description);
    const g = groups.get(key) ?? { name: cleanDescription(t.description), amounts: [], months: new Set<string>(), dates: [] };
    g.amounts.push(t.amount);
    g.months.add(t.date.slice(0, 7));
    g.dates.push(t.date);
    groups.set(key, g);
  }

  const subs: Subscription[] = [];
  for (const [key, g] of groups) {
    // Require strong evidence: 3+ distinct months and 3+ charges
    if (g.months.size < 3 || g.amounts.length < 3) continue;
    // A subscription charges about once a month; a shop you visit often doesn't.
    if (g.amounts.length > g.months.size * 1.25) continue;

    // Round the median to clean cents: it is both the displayed representative
    // charge and the basis for the tolerance check.
    const mid = roundMoney(median(g.amounts));
    // A subscription charges the same price, or switches once to a new price
    // (12.99 → 13.99). Shopping at the same shop varies every time, so: at most
    // two distinct prices within 15% of the median, or every charge within 3%.
    const distinct = new Set(g.amounts.map(roundMoney)).size;
    const within = (pct: number) => g.amounts.every((a) => Math.abs(a - mid) <= Math.max(0.5, mid * pct));
    if (!((distinct <= 2 && within(0.15)) || within(0.03))) continue;

    // Gaps between consecutive charges must be monthly (20–35 days) or bi-monthly (36–65).
    const dates = [...g.dates].sort();
    const intervals = dates.slice(1).map((d, i) => Math.round((parseDateStr(d).getTime() - parseDateStr(dates[i]).getTime()) / MS_PER_DAY));
    const medianInterval = median(intervals);
    if (medianInterval < 20 || medianInterval > 65) continue;
    if (!intervals.every((iv) => Math.abs(iv - medianInterval) <= medianInterval * 0.5)) continue;

    subs.push({
      key,
      name: g.name,
      amount: mid,
      total: roundMoney(g.amounts.reduce((s, a) => s + a, 0)),
      months: g.months.size,
      lastDate: dates[dates.length - 1],
      everyMonths: medianInterval > 35 ? 2 : 1,
    });
  }

  return subs.sort((a, b) => b.months - a.months || b.amount - a.amount);
}

/**
 * When a subscription should next charge: its last charge date stepped forward
 * by its rhythm until it's after today (clamped to shorter months).
 */
export function nextChargeDate(sub: Pick<Subscription, "lastDate" | "everyMonths">, today: Date): string {
  const todayStr = toDateStr(today);
  const [y, m, d] = sub.lastDate.split("-").map(Number);
  for (let step = sub.everyMonths; ; step += sub.everyMonths) {
    const month = new Date(y, m - 1 + step, 1);
    const candidate = toDateStr(new Date(month.getFullYear(), month.getMonth(), clampDayToMonth(month.getFullYear(), month.getMonth(), d)));
    if (candidate > todayStr) return candidate;
  }
}

export interface PeriodInsights {
  /** Number of spending transactions in the period. */
  txCount: number;
  /** Net spending including savings moves. */
  totalSpent: number;
  /** Net spending excluding savings — what "spent" means everywhere in Monera. */
  spending: number;
  prevSpending: number;
  byCategory: Record<Category, number>;
  prevByCategory: Record<Category, number>;
  /** True when "prev" covers last period only up to the same day as today. */
  comparedToSamePoint: boolean;
}

/** One pay period's spending, compared with the period before. */
export function buildPeriodInsights(
  transactions: Transaction[],
  periodKey: string,
  paydayOfMonth: number,
  now: Date = new Date()
): PeriodInsights {
  const range = getPeriodRange(periodKey, paydayOfMonth);
  const spend = getPeriodSpend(transactions, periodKey, paydayOfMonth);

  // Compare like with like: while a period is still running, set it against last
  // period only up to the same day, not against last period's full total.
  const { start, end } = getPeriodBounds(periodKey, paydayOfMonth);
  const comparedToSamePoint = now >= start && now <= end;
  const prevKey = addMonths(periodKey, -1);
  let prevByCategory: Record<Category, number>;
  if (comparedToSamePoint) {
    const prevStart = getPeriodBounds(prevKey, paydayOfMonth).start;
    const cutoff = new Date(prevStart.getTime() + (now.getTime() - start.getTime()));
    const prevRange = { from: toDateStr(prevStart), to: toDateStr(cutoff) };
    prevByCategory = netExpenseByCategory(transactions.filter((t) => inRange(t.date, prevRange)));
  } else {
    prevByCategory = getPeriodSpend(transactions, prevKey, paydayOfMonth).byCategory;
  }
  const prevTotal = prevByCategory.Needs + prevByCategory.Wants + prevByCategory.Savings + prevByCategory.Uncategorized;

  return {
    txCount: transactions.filter((t) => !t.excluded && t.type === "expense" && inRange(t.date, range)).length,
    totalSpent: spend.total,
    spending: roundMoney(spend.total - spend.byCategory.Savings),
    prevSpending: roundMoney(prevTotal - prevByCategory.Savings),
    byCategory: spend.byCategory,
    prevByCategory,
    comparedToSamePoint,
  };
}
