import { Transaction, Category } from "@/types";
import { getPeriodBounds } from "@/lib/utils";

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
  return description.replace(/\s+/g, " ").trim();
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

function prevMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function buildReport(
  transactions: Transaction[],
  monthKey: string,
  paydayOfMonth: number
): ReportData {
  const expenses = periodExpenses(transactions, monthKey, paydayOfMonth);
  const prevExpenses = periodExpenses(transactions, prevMonthKey(monthKey), paydayOfMonth);

  const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);
  const prevTotal = prevExpenses.reduce((s, t) => s + t.amount, 0);

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

  // Category breakdown
  const cats: Category[] = ["Needs", "Wants", "Savings", "Uncategorized"];
  const byCategory: CategoryStat[] = cats
    .map((category) => {
      const total = expenses.filter((t) => t.category === category).reduce((s, t) => s + t.amount, 0);
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
    changePct,
    topMerchants,
    frequentMerchants,
    biggest,
    byCategory,
  };
}
