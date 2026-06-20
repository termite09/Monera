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
  const defaultIncome = settings.defaultIncome ?? 0;
  const salaryKeywords = settings.salaryKeywords ?? [];

  // Planned salary: per-period override > standing default > 0
  const salaryBasis = configuredIncome > 0 ? configuredIncome : defaultIncome > 0 ? defaultIncome : 0;

  const detectedIncome = roundMoney(monthIncomeTxs.reduce((s, t) => s + t.amount, 0));

  // Income transactions that aren't the employer's salary payment.
  // When employer keywords are configured, the matching transaction is the salary
  // already covered by salaryBasis — filtering it out prevents double-counting.
  // When no keywords are set, all detected income is treated as additional.
  const additionalIncome = roundMoney(
    monthIncomeTxs
      .filter((t) =>
        salaryKeywords.length === 0 ||
        !salaryKeywords.some((k) => t.description.toLowerCase().includes(k.toLowerCase()))
      )
      .reduce((s, t) => s + t.amount, 0)
  );

  // Total income = planned salary + income transactions.
  // When employer keywords are set: only non-salary transactions are added (the salary
  // transaction in the CSV is already represented by salaryBasis).
  // When no keywords: all income transactions count as additional (user can set employer
  // keywords in Settings → Sources if their salary also appears in Revolut).
  // When no salary basis: income = everything detected.
  const income = roundMoney(
    salaryBasis > 0
      ? salaryBasis + (salaryKeywords.length > 0 ? additionalIncome : detectedIncome)
      : detectedIncome
  );
  const incomeIsDetected = detectedIncome > 0;

  // Single source of truth for period spend / refund-netting — shared with the
  // reports page so the two can never show different totals.
  const { byCategory } = getPeriodSpend(transactions, month, paydayOfMonth);
  const needs = byCategory.Needs;
  const wants = byCategory.Wants;
  const savings = byCategory.Savings;
  const uncategorizedExpense = byCategory.Uncategorized;

  const summary: MonthSummary = {
    income,
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

  return { paydayOfMonth, summary, budgetAllocations, budgetRule, incomeIsDetected, salaryBasis, additionalIncome };
}
