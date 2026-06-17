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

  // Individual transfers = CSV income excluding anything matching salary keywords
  const individualTransfers = monthIncomeTxs
    .filter((t) =>
      salaryKeywords.length === 0 ||
      !salaryKeywords.some((k) => t.description.toLowerCase().includes(k.toLowerCase()))
    )
    .reduce((s, t) => s + t.amount, 0);

  const sumBy = (txs: Transaction[], cat: Transaction["category"]) =>
    txs.filter((t) => t.category === cat).reduce((s, t) => s + t.amount, 0);

  // Refunds arrive as income-typed transactions categorized to the same bucket
  // as the original purchase (e.g. an AlphaMega refund -> Wants). Net them out
  // so category spending reflects what you actually kept, never going negative.
  const netSpend = (cat: Transaction["category"]) =>
    Math.max(0, sumBy(monthTxs, cat) - sumBy(monthIncomeTxs, cat));

  const needs = netSpend("Needs");
  const wants = netSpend("Wants");
  const savings = netSpend("Savings");
  // Uncategorized expenses are shown as-is (salary income is Uncategorized and
  // must not erase real uncategorized spending).
  const uncategorizedExpense = sumBy(monthTxs, "Uncategorized");

  const summary: MonthSummary = {
    income: configuredIncome,
    transfersReceived: individualTransfers,
    totalExpenses: needs + wants + savings + uncategorizedExpense,
    needs,
    wants,
    savings,
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
