import { Transaction, Settings, MonthSummary } from "@/types";
import { getPeriodBounds, roundMoney } from "@/lib/utils";
import { getPeriodSpend } from "@/lib/finance";

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

  const monthIncomeTxs = transactions.filter((tx) => inPeriod(tx) && tx.type === "income");

  const monthBudget = settings.monthlyBudgets[month];
  const budgetRule = monthBudget?.budgetRule ?? settings.defaultBudgetRule;
  const configuredIncome = monthBudget?.income ?? 0;
  const salaryKeywords = settings.salaryKeywords ?? [];

  // Total income actually received this period (self-transfers already removed
  // upstream). Used as a fallback so the dashboard reflects real deposits instead
  // of €0 when the user hasn't entered a planned figure.
  const detectedIncome = roundMoney(monthIncomeTxs.reduce((s, t) => s + t.amount, 0));

  // A configured planned income (explicit intent) wins; otherwise reconcile with
  // what the statement shows.
  const income = roundMoney(configuredIncome > 0 ? configuredIncome : detectedIncome);
  const incomeIsDetected = configuredIncome <= 0 && detectedIncome > 0;

  // Individual transfers = CSV income excluding anything matching salary keywords
  const individualTransfers = roundMoney(
    monthIncomeTxs
      .filter((t) =>
        salaryKeywords.length === 0 ||
        !salaryKeywords.some((k) => t.description.toLowerCase().includes(k.toLowerCase()))
      )
      .reduce((s, t) => s + t.amount, 0)
  );

  // Single source of truth for period spend / refund-netting — shared with the
  // reports page so the two can never show different totals.
  const { byCategory } = getPeriodSpend(transactions, month, paydayOfMonth);
  const needs = byCategory.Needs;
  const wants = byCategory.Wants;
  const savings = byCategory.Savings;
  const uncategorizedExpense = byCategory.Uncategorized;

  const summary: MonthSummary = {
    income,
    transfersReceived: individualTransfers,
    totalExpenses: roundMoney(needs + wants + savings + uncategorizedExpense),
    needs,
    wants,
    savings,
    remaining: 0,
  };
  summary.remaining = roundMoney(summary.income - summary.totalExpenses);

  const budgetAllocations = {
    needs: roundMoney((summary.income * budgetRule.needs) / 100),
    wants: roundMoney((summary.income * budgetRule.wants) / 100),
    savings: roundMoney((summary.income * budgetRule.savings) / 100),
  };

  return { paydayOfMonth, summary, budgetAllocations, budgetRule, incomeIsDetected };
}
