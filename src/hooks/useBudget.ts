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

  // Money in this period. Refunds are income tagged to a spending category and are
  // already netted against that category's spend, so they are not income too.
  const monthIncomeTxs = transactions.filter(
    (tx) => inPeriod(tx) && tx.type === "income" && tx.category === "Uncategorized"
  );

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

  // Expected pay: per-period override > standing default > 0. This is what the
  // user told us they earn — a stand-in until the real deposit shows up.
  const salaryBasis = configuredIncome > 0 ? configuredIncome : defaultIncome > 0 ? defaultIncome : 0;

  const detectedIncome = roundMoney(monthIncomeTxs.reduce((s, t) => s + t.amount, 0));
  const salaryTxs = findSalaryTxs(monthIncomeTxs, salaryKeywords, salaryBasis);
  const detectedSalary = roundMoney(salaryTxs.reduce((s, t) => s + t.amount, 0));

  // Everything that isn't pay: freelance, transfers from friends, interest...
  const additionalIncome = roundMoney(detectedIncome - detectedSalary);

  // Pay is counted once: the real deposit when the statement has it, otherwise
  // the expected amount. Other income always adds on top.
  const salaryFromStatement = detectedSalary > 0;
  const salaryUsed = salaryFromStatement ? detectedSalary : salaryBasis;
  const income = roundMoney(salaryUsed + additionalIncome);
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

  return {
    paydayOfMonth, summary, budgetAllocations, budgetRule, incomeIsDetected,
    salaryBasis, additionalIncome, salaryUsed, salaryFromStatement,
    salaryTxIds: salaryTxs.map((t) => t.id),
    /** The deposit we took to be pay, when it wasn't matched by a saved keyword — worth confirming. */
    unconfirmedSalaryTx: salaryBasis > 0 && salaryFromStatement && !salaryTxs.some((t) => matchesKeyword(t, salaryKeywords)) ? salaryTxs[0] : null,
  };
}

function matchesKeyword(tx: Transaction, keywords: string[]): boolean {
  const desc = tx.description.toLowerCase();
  return keywords.some((k) => k.trim() !== "" && desc.includes(k.toLowerCase()));
}

/**
 * Which of the period's deposits are the user's pay.
 *  1. Deposits matching a saved salary keyword (several employers all count).
 *  2. Otherwise, when we know roughly what they earn, the largest deposit that's
 *     at least half of it — so typing your pay AND importing the statement that
 *     contains it never counts it twice.
 *  3. Otherwise, with no expected pay, the largest deposit (labelling only — all
 *     deposits count as income either way).
 */
export function findSalaryTxs(incomeTxs: Transaction[], keywords: string[], expectedPay: number): Transaction[] {
  const byKeyword = incomeTxs.filter((t) => matchesKeyword(t, keywords));
  if (byKeyword.length > 0) return byKeyword;
  const largestFirst = [...incomeTxs].sort((a, b) => b.amount - a.amount);
  if (expectedPay > 0) {
    const likely = largestFirst.find((t) => t.amount >= expectedPay * 0.5);
    return likely ? [likely] : [];
  }
  return largestFirst.slice(0, 1);
}
