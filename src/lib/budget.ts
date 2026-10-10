import { Transaction, Settings, PeriodSummary } from "@/types";
import { getPeriodRange, inRange, roundMoney } from "@/lib/utils";
import { getPeriodSpend } from "@/lib/finance";

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
function findSalaryTxs(incomeTxs: Transaction[], keywords: string[], expectedPay: number): Transaction[] {
  const byKeyword = incomeTxs.filter((t) => matchesKeyword(t, keywords));
  if (byKeyword.length > 0) return byKeyword;
  const largestFirst = [...incomeTxs].sort((a, b) => b.amount - a.amount);
  if (expectedPay > 0) {
    const likely = largestFirst.find((t) => t.amount >= expectedPay * 0.5);
    return likely ? [likely] : [];
  }
  return largestFirst.slice(0, 1);
}

/** Income, spending and budget allocations for one pay period. */
export function computeBudget(transactions: Transaction[], settings: Settings, periodKey: string) {
  const { paydayOfMonth } = settings;
  const range = getPeriodRange(periodKey, paydayOfMonth);

  // Money in this period. Refunds are income tagged to a spending category and are
  // already netted against that category's spend, so they are not income too.
  const periodIncomeTxs = transactions.filter(
    (tx) => !tx.excluded && tx.type === "income" && tx.category === "Uncategorized" && inRange(tx.date, range)
  );

  const periodBudget = settings.monthlyBudgets[periodKey];
  const budgetRule = periodBudget?.budgetRule ?? settings.defaultBudgetRule;
  const configuredIncome = periodBudget?.income ?? 0;
  const defaultIncome = settings.defaultIncome ?? 0;

  // Expected pay: per-period override > standing default > 0. This is what the
  // user told us they earn — a stand-in until the real deposit shows up.
  const salaryBasis = configuredIncome > 0 ? configuredIncome : Math.max(0, defaultIncome);

  const detectedIncome = roundMoney(periodIncomeTxs.reduce((s, t) => s + t.amount, 0));
  const salaryTxs = findSalaryTxs(periodIncomeTxs, settings.salaryKeywords, salaryBasis);
  const detectedSalary = roundMoney(salaryTxs.reduce((s, t) => s + t.amount, 0));

  // Everything that isn't pay: freelance, transfers from friends, interest...
  const additionalIncome = roundMoney(detectedIncome - detectedSalary);

  // Pay is counted once: the real deposit when the statement has it, otherwise
  // the expected amount. Other income always adds on top.
  const salaryFromStatement = detectedSalary > 0;
  const salaryUsed = salaryFromStatement ? detectedSalary : salaryBasis;
  const income = roundMoney(salaryUsed + additionalIncome);

  // Single source of truth for period spend / refund-netting — shared with
  // Insights so the two can never show different totals.
  const { byCategory, total } = getPeriodSpend(transactions, periodKey, paydayOfMonth);

  const summary: PeriodSummary = {
    income,
    totalExpenses: total,
    needs: byCategory.Needs,
    wants: byCategory.Wants,
    savings: byCategory.Savings,
    remaining: roundMoney(income - total),
  };

  const budgetAllocations = {
    needs: roundMoney((income * budgetRule.needs) / 100),
    wants: roundMoney((income * budgetRule.wants) / 100),
    savings: roundMoney((income * budgetRule.savings) / 100),
  };

  return {
    summary,
    /** Spending not sorted into a category yet — counted against Wants on screen. */
    uncategorizedExpense: byCategory.Uncategorized,
    budgetAllocations,
    budgetRule,
    incomeIsDetected: detectedIncome > 0,
    salaryBasis,
    additionalIncome,
    salaryUsed,
    salaryFromStatement,
    salaryTxIds: salaryTxs.map((t) => t.id),
    /** The deposit we took to be pay, when it wasn't matched by a saved keyword — worth confirming. */
    unconfirmedSalaryTx:
      salaryBasis > 0 && salaryFromStatement && !salaryTxs.some((t) => matchesKeyword(t, settings.salaryKeywords))
        ? salaryTxs[0]
        : null,
  };
}

export type Budget = ReturnType<typeof computeBudget>;
