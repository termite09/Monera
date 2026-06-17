import { Transaction, Settings, MonthSummary } from "@/types";
import { getPeriodBounds } from "@/lib/utils";

export function useBudget(
  transactions: Transaction[],
  settings: Settings,
  month: string
) {
  const paydayOfMonth = settings.paydayOfMonth ?? 1;
  const { start, end } = getPeriodBounds(month, paydayOfMonth);

  const inPeriod = (tx: Transaction) => {
    if (tx.excluded) return false;
    const d = new Date(tx.date + "T00:00:00");
    return d >= start && d <= end;
  };

  const monthTxs = transactions.filter((tx) => inPeriod(tx) && tx.type === "expense");
  const monthIncomeTxs = transactions.filter((tx) => inPeriod(tx) && tx.type === "income");

  const monthBudget = settings.monthlyBudgets[month];
  const budgetRule = monthBudget?.budgetRule ?? settings.defaultBudgetRule;
  const configuredIncome = monthBudget?.income ?? 0;
  const salaryKeywords = settings.salaryKeywords ?? [];

  const csvIncome = monthIncomeTxs.reduce((s, t) => s + t.amount, 0);

  // Individual transfers = CSV income excluding anything matching salary keywords
  const individualTransfers = monthIncomeTxs
    .filter((t) =>
      salaryKeywords.length === 0 ||
      !salaryKeywords.some((k) => t.description.toLowerCase().includes(k.toLowerCase()))
    )
    .reduce((s, t) => s + t.amount, 0);

  const summary: MonthSummary = {
    income: configuredIncome,
    transfersReceived: individualTransfers,
    totalExpenses: monthTxs.reduce((s, t) => s + t.amount, 0),
    needs: monthTxs.filter((t) => t.category === "Needs").reduce((s, t) => s + t.amount, 0),
    wants: monthTxs.filter((t) => t.category === "Wants").reduce((s, t) => s + t.amount, 0),
    savings: monthTxs.filter((t) => t.category === "Savings").reduce((s, t) => s + t.amount, 0),
    remaining: 0,
  };
  summary.remaining = summary.income - summary.totalExpenses;

  const budgetAllocations = {
    needs: (summary.income * budgetRule.needs) / 100,
    wants: (summary.income * budgetRule.wants) / 100,
    savings: (summary.income * budgetRule.savings) / 100,
  };

  return { paydayOfMonth, summary, budgetAllocations, budgetRule };
}
