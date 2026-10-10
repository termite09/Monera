import { useMemo } from "react";
import type { Transaction, Settings, PeriodTiming } from "@/types";
import { useBudget } from "@/hooks/useBudget";
import { getRecurringTransactions } from "@/lib/recurring";
import { computeSafeToSpend, expectedSubscriptionCharges, nextPayday } from "@/lib/safeToSpend";
import { detectSubscriptions } from "@/lib/insights";
import { getCurrentPeriodKey, getPeriodRange, inRange, parseDateStr } from "@/lib/utils";

/** Everything the dashboard shows for one pay period, derived from the app's data. */
export function useDashboardData({ transactions, settings, currency, periodKey, today }: {
  transactions: Transaction[];
  settings: Settings;
  currency: string;
  periodKey: string;
  /** "YYYY-MM-DD" */
  today: string;
}) {
  const { paydayOfMonth } = settings;
  const range = useMemo(() => getPeriodRange(periodKey, paydayOfMonth), [periodKey, paydayOfMonth]);

  // The period's bills join the imported transactions; only what has happened
  // so far counts towards the figures (later bills are "still due").
  const allTxs = useMemo(
    () => [...transactions, ...getRecurringTransactions(settings.recurringPayments, periodKey, paydayOfMonth, currency)],
    [transactions, settings.recurringPayments, periodKey, paydayOfMonth, currency]
  );
  const currentTxs = useMemo(() => allTxs.filter((tx) => tx.date <= today), [allTxs, today]);

  const budget = useBudget(currentTxs, settings, periodKey);

  // Detected subscriptions expected before payday. Safe to spend holds them back,
  // and the "Upcoming bills" card lists exactly what Safe to spend holds back.
  const safeInfo = useMemo(() => {
    const now = new Date();
    const subscriptions = detectSubscriptions(transactions).filter((s) => !settings.excludedSubscriptions?.includes(s.name));
    return computeSafeToSpend({
      transactions: allTxs,
      periodKey,
      paydayOfMonth,
      summary: budget.summary,
      now,
      savingsTarget: budget.budgetAllocations.savings,
      expectedCharges: expectedSubscriptionCharges(subscriptions, parseDateStr(today), range.to),
    });
  }, [transactions, allTxs, settings.excludedSubscriptions, periodKey, paydayOfMonth, budget, today, range.to]);

  // The period's transactions for the drill-down sheets, newest first.
  const { expenses, income, savings } = useMemo(() => {
    const out = { expenses: [] as Transaction[], income: [] as Transaction[], savings: [] as Transaction[] };
    for (const tx of currentTxs) {
      if (tx.excluded || !inRange(tx.date, range)) continue;
      if (tx.type === "income") out.income.push(tx);
      else {
        out.expenses.push(tx);
        if (tx.category === "Savings") out.savings.push(tx);
      }
    }
    for (const list of Object.values(out)) list.sort((a, b) => b.date.localeCompare(a.date));
    return out;
  }, [currentTxs, range]);

  // How current the numbers are: the newest transaction from an imported statement.
  const latestImported = useMemo(
    () => transactions.reduce<string | null>((latest, t) => (t.source === "statement" && (!latest || t.date > latest) ? t.date : latest), null),
    [transactions]
  );

  const currentKey = getCurrentPeriodKey(paydayOfMonth);
  const timing: PeriodTiming = periodKey === currentKey ? "current" : periodKey < currentKey ? "past" : "future";
  // No statement covers the running period yet — a confident number would be a guess.
  const noStatement = timing === "current" && (latestImported === null || latestImported < range.from);

  // Bills still to come, by category — the circles count them so that
  // Needs left + Wants left is exactly Safe to spend.
  const dueBy = { Needs: 0, Wants: 0, Savings: 0 };
  for (const b of safeInfo.billItems) {
    if (b.category === "Needs" || b.category === "Savings") dueBy[b.category] += b.amount;
    else dueBy.Wants += b.amount; // Wants and anything not yet sorted
  }

  return {
    range,
    currentTxs,
    budget,
    safeInfo,
    periodExpenseTxs: expenses,
    periodIncomeTxs: income,
    periodSavingsTxs: savings,
    latestImported,
    timing,
    noStatement,
    dueBy,
    payday: nextPayday(periodKey, paydayOfMonth),
  };
}
