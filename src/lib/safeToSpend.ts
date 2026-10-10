import { Transaction, PeriodSummary, TransactionSource, Category } from "@/types";
import { getPeriodBounds, roundMoney, toDateStr, daysToPayday, getPeriodRange, inRange } from "@/lib/utils";
import { netExpenseByCategory, netExpenseTotal } from "@/lib/finance";
import { nextChargeDate, type Subscription } from "@/lib/insights";

/** A charge still to come before payday: a bill, a dated entry, or an expected subscription. */
export interface UpcomingBill {
  name: string;
  amount: number;
  date: string;
  source: TransactionSource;
  category: Category;
  /** A detected subscription whose next charge is inferred from the last one. */
  estimated?: boolean;
  lastChargeDate?: string;
}

/** A detected subscription expected to charge on `date`. */
export interface ExpectedCharge {
  name: string;
  amount: number;
  date: string;
  lastChargeDate: string;
}

/** Short label for what kind of upcoming charge this is. */
export function billKind(bill: UpcomingBill): string {
  if (bill.estimated) return "Expected";
  if (bill.category === "Savings") return "Savings transfer";
  if (bill.source === "manual") return "Added by you";
  return "Regular bill";
}

/** Detected subscriptions whose next charge falls after today and on or before `until` (YYYY-MM-DD). */
export function expectedSubscriptionCharges(subscriptions: Subscription[], today: Date, until: string): ExpectedCharge[] {
  return subscriptions
    .map((s) => ({ name: s.name, amount: s.amount, date: nextChargeDate(s, today), lastChargeDate: s.lastDate }))
    .filter((c) => c.date <= until);
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
  /** The rest of this period's savings target, held back so it isn't spent. */
  savingsSetAside: number;
  billItems: UpcomingBill[];
  safe: number;
  /** Days from today until the period ends (next payday). */
  daysLeft: number;
}

/**
 * What "safe to spend" works out to per day until payday — the number that turns
 * a balance into something you can act on. Null when there's nothing to spread
 * (no days left, or nothing safe to spend).
 */
export function dailyAllowance(safe: number, daysLeft: number): number | null {
  if (daysLeft <= 0 || safe <= 0) return null;
  return Math.floor((safe / daysLeft) * 100) / 100;
}

/** The next payday after the given period — the day after the period ends. */
export function nextPayday(periodKey: string, paydayOfMonth: number): Date {
  const { end } = getPeriodBounds(periodKey, paydayOfMonth);
  return new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
}

const notApplicable = (reason: SafeToSpend["reason"], income = 0): SafeToSpend => ({
  applicable: false,
  reason,
  income,
  spentSoFar: 0,
  savedSoFar: 0,
  billsDue: 0,
  savingsSetAside: 0,
  billItems: [],
  safe: 0,
  daysLeft: 0,
});

export interface SafeToSpendInput {
  /** Every transaction, including the period's generated recurring bills. */
  transactions: Transaction[];
  periodKey: string;
  paydayOfMonth: number;
  summary: PeriodSummary;
  /** Injected so the result is deterministic in tests. */
  now: Date;
  /** This period's savings target (income × savings %). 0 = don't hold any back. */
  savingsTarget?: number;
  /** Detected subscriptions expected before payday — held back like bills. */
  expectedCharges?: ExpectedCharge[];
}

/**
 * Forward-looking "what you can still spend before payday" for the CURRENT
 * period:
 *
 *   safe = income − spent so far − saved so far − payments still due
 *          − whatever is still needed to reach this period's savings target
 *
 * Only meaningful for the period containing `now`; other periods (and accounts
 * with no income configured/detected) return applicable:false so the UI can
 * degrade honestly instead of showing a confident number built on nothing.
 */
export function computeSafeToSpend({
  transactions, periodKey, paydayOfMonth, summary, now, savingsTarget = 0, expectedCharges = [],
}: SafeToSpendInput): SafeToSpend {
  const { start, end } = getPeriodBounds(periodKey, paydayOfMonth);
  if (now < start || now > end) return notApplicable("not-current-period");
  if (summary.income <= 0) return notApplicable("no-income", summary.income);

  // Split the period's live transactions by whether they've happened yet.
  const range = getPeriodRange(periodKey, paydayOfMonth);
  const nowStr = toDateStr(now);
  const periodTxs = transactions.filter((tx) => !tx.excluded && inRange(tx.date, range));
  const incurred = periodTxs.filter((tx) => tx.date <= nowStr);
  const upcoming = periodTxs.filter((tx) => tx.type === "expense" && tx.date > nowStr);

  // Reuse the single netting implementation so these figures reconcile with the
  // dashboard/Insights totals.
  const incurredByCat = netExpenseByCategory(incurred);
  const spentSoFar = roundMoney(incurredByCat.Needs + incurredByCat.Wants + incurredByCat.Uncategorized);
  const savedSoFar = incurredByCat.Savings;

  // Expected subscriptions due before payday, unless a bill with the same name
  // is already listed (a bill the user added wins over our guess).
  const known = new Set(upcoming.map((tx) => tx.description.trim().toLowerCase()));
  const estimates = expectedCharges.filter(
    (c) => c.date > nowStr && c.date <= range.to && !known.has(c.name.trim().toLowerCase())
  );

  const billsDue = roundMoney(netExpenseTotal(upcoming) + estimates.reduce((s, c) => s + c.amount, 0));
  const billItems: UpcomingBill[] = [
    ...upcoming.map((tx) => ({ name: tx.description, amount: tx.amount, date: tx.date, source: tx.source, category: tx.category })),
    ...estimates.map((c) => ({
      name: c.name, amount: c.amount, date: c.date, source: "statement" as const, category: "Wants" as const,
      estimated: true, lastChargeDate: c.lastChargeDate,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Savings transfers already scheduled (a recurring Savings bill) count towards
  // the target, so the same money isn't held back twice.
  const savingsDue = upcoming.filter((tx) => tx.category === "Savings").reduce((s, tx) => s + tx.amount, 0);
  const savingsSetAside = roundMoney(Math.max(0, savingsTarget - savedSoFar - savingsDue));

  return {
    applicable: true,
    income: summary.income,
    spentSoFar,
    savedSoFar,
    billsDue,
    savingsSetAside,
    billItems,
    safe: roundMoney(summary.income - spentSoFar - savedSoFar - billsDue - savingsSetAside),
    daysLeft: daysToPayday(periodKey, paydayOfMonth, now),
  };
}
