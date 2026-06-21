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
  if (process.env.NODE_ENV === "development") {
    const ruleSum = budgetRule.needs + budgetRule.wants + budgetRule.savings;
    if (ruleSum !== 100) {
      console.warn(`[useBudget] Budget rule percentages sum to ${ruleSum}, expected 100`);
    }
  }
  const configuredIncome = monthBudget?.income ?? 0;
  const defaultIncome = settings.defaultIncome ?? 0;
  const salaryKeywords = settings.salaryKeywords ?? [];

  // Planned salary: per-period override > standing default > 0
  const salaryBasis = configuredIncome > 0 ? configuredIncome : defaultIncome > 0 ? defaultIncome : 0;

  const detectedIncome = roundMoney(monthIncomeTxs.reduce((s, t) => s + t.amount, 0));

  // Non-salary income: transactions that don't match any salary keyword.
  // Used by the dashboard income card to show the breakdown of other income sources.
  const additionalIncome = roundMoney(
    monthIncomeTxs
      .filter((t) =>
        salaryKeywords.length === 0 ||
        !salaryKeywords.some((k) => t.description.toLowerCase().includes(k.toLowerCase()))
      )
      .reduce((s, t) => s + t.amount, 0)
  );

  // salaryBasis is a planned/configured income (e.g. primary job paid via a
  // different account, or a standing retainer). It combines with ALL detected
  // bank-statement income — salary-keyword transactions included — so that
  // multiple salary sources from different employers are all counted.
  const income = roundMoney(salaryBasis > 0 ? salaryBasis + detectedIncome : detectedIncome);
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
