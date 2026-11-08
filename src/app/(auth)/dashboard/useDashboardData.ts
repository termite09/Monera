import { useMemo } from "react";
import type { Transaction, Settings, PeriodTiming } from "@/types";
import { useBudget } from "@/hooks/useBudget";
import type { CoverageSummary } from "@/lib/coverage";
import { computeSafeToSpend, expectedSubscriptionCharges, nextPayday } from "@/lib/safeToSpend";
import { detectSubscriptions } from "@/lib/insights";
import { getCurrentPeriodKey, getPeriodRange, inRange, parseDateStr } from "@/lib/periods";

/** Everything the dashboard shows for one pay period, derived from the app's data. */
export function useDashboardData({ transactions, bills, coverage, settings, periodKey, today }: {
  transactions: Transaction[];
  /** From the app data: the bills between two dates. */
  bills: (from: string, to: string) => Transaction[];
  /** What the statements cover, from the app data. */
  coverage: CoverageSummary | null;
  settings: Settings;
  periodKey: string;
  /** "YYYY-MM-DD" */
  today: string;
}) {
  const { paydayOfMonth } = settings;
  const range = useMemo(() => getPeriodRange(periodKey, paydayOfMonth), [periodKey, paydayOfMonth]);

  // The period's bills join the imported transactions; only what has happened
  // so far counts towards the figures (later bills are "still due").
  const allTxs = useMemo(() => [...transactions, ...bills(range.from, range.to)], [transactions, bills, range]);
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

  // How current the numbers are: the last day a statement covers. That's the
  // later of its newest transaction and its last settled row of any kind (a
  // top-up on the export's last day still shows the export reaches that day),
  // so the dashboard and the Statements page give the same date.
  const latestImported = useMemo(() => {
    const newest = transactions.reduce<string | null>((latest, t) => (t.source === "statement" && (!latest || t.date > latest) ? t.date : latest), null);
    return coverage && (!newest || coverage.to > newest) ? coverage.to : newest;
  }, [transactions, coverage]);

  // Stretches of this pay period no statement covers although money moved.
  const periodGaps = useMemo(
    () => (coverage?.gaps ?? []).filter((g) => g.from <= range.to && g.to >= range.from),
    [coverage, range]
  );

  const currentKey = getCurrentPeriodKey(paydayOfMonth);
  const timing: PeriodTiming = periodKey === currentKey ? "current" : periodKey < currentKey ? "past" : "future";
  // No statement covers the running period yet — a confident number would be a guess.
  const noStatement = timing === "current" && (latestImported === null || latestImported < range.from);

  // Bills still to come, by category — the circles count them as committed.
  const dueBy = { Needs: 0, Wants: 0, Savings: 0 };
  for (const b of safeInfo.billItems) {
    const cat = b.category === "Needs" || b.category === "Savings" ? b.category : "Wants"; // Wants and anything not yet sorted
    dueBy[cat] += b.amount;
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
    periodGaps,
    timing,
    noStatement,
    dueBy,
    payday: nextPayday(periodKey, paydayOfMonth),
  };
}
