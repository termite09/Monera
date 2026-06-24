import { Transaction, Settings, MonthSummary, TransactionSource, Category } from "@/types";
import { getPeriodBounds, roundMoney } from "@/lib/utils";
import { netExpenseByCategory, netExpenseTotal } from "@/lib/finance";

export interface SafeToSpendBillItem {
  name: string;
  amount: number;
  date: string;
  source: TransactionSource;
  category: Category;
}

export interface SafeToSpend {
  applicable: boolean;
  /** Why the number isn't shown, when applicable is false. */
  reason?: "not-current-period" | "no-income";
  income: number;
  /** Net incurred spend (Needs + Wants + Uncategorized), date ≤ today. */
  spentSoFar: number;
  /** Net incurred Savings-category outflows, date ≤ today. */
  savedSoFar: number;
  /** Committed charges still to come this period (date > today). */
  billsDue: number;
  billItems: SafeToSpendBillItem[];
  safe: number;
  /** Days from today until the period ends (next payday). */
  daysLeft: number;
}

const notApplicable = (reason: SafeToSpend["reason"], income = 0): SafeToSpend => ({
  applicable: false,
  reason,
  income,
  spentSoFar: 0,
  savedSoFar: 0,
  billsDue: 0,
  billItems: [],
  safe: 0,
  daysLeft: 0,
});

/**
 * Forward-looking "what you can still spend before payday" for the CURRENT
 * period. Pure over data the app already computes (summary + allocations from
 * useBudget, plus the period's transactions incl. injected recurring bills) —
 * no new storage. `now` is injected so the result is deterministic in tests.
 *
 *   safe = income − spent so far − saved so far − payments still due
 *
 * Only meaningful for the period containing `now`; other periods (and accounts
 * with no income configured/detected) return applicable:false so the UI can
 * degrade honestly instead of showing a confident number built on nothing.
 */
export function computeSafeToSpend(
  allTxs: Transaction[],
  settings: Settings,
  monthKey: string,
  summary: MonthSummary,
  now: Date
): SafeToSpend {
  const payday = settings.paydayOfMonth ?? 1;
  const { start, end } = getPeriodBounds(monthKey, payday);

  if (now < start || now > end) return notApplicable("not-current-period");
  if (summary.income <= 0) return notApplicable("no-income", summary.income);

  // Split the period's live transactions by whether they've happened yet.
  const periodTxs = allTxs.filter((tx) => {
    if (tx.excluded) return false;
    const d = new Date(tx.date + "T00:00:00");
    return d >= start && d <= end;
  });
  const incurred = periodTxs.filter((tx) => new Date(tx.date + "T00:00:00") <= now);
  const upcoming = periodTxs.filter(
    (tx) => tx.type === "expense" && new Date(tx.date + "T00:00:00") > now
  );

  // Reuse the single netting implementation so these figures reconcile with the
  // dashboard/reports totals.
  const incurredByCat = netExpenseByCategory(incurred);
  const spentSoFar = roundMoney(incurredByCat.Needs + incurredByCat.Wants + incurredByCat.Uncategorized);
  const savedSoFar = incurredByCat.Savings;

  const billsDue = netExpenseTotal(upcoming);
  const billItems: SafeToSpendBillItem[] = upcoming
    .map((tx) => ({ name: tx.description, amount: tx.amount, date: tx.date, source: tx.source, category: tx.category }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const safe = roundMoney(summary.income - spentSoFar - savedSoFar - billsDue);
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));

  return {
    applicable: true,
    income: summary.income,
    spentSoFar,
    savedSoFar,
    billsDue,
    billItems,
    safe,
    daysLeft,
  };
}
