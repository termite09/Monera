import { Transaction, Category } from "@/types";
import { getPeriodBounds, roundMoney } from "@/lib/utils";

export interface PeriodSpend {
  byCategory: Record<Category, number>;
  total: number;
}

/**
 * The single source of truth for how much was *spent* in a budget period.
 *
 * Refunds arrive as income-typed transactions categorized to the same bucket as
 * the original purchase (e.g. an AlphaMega refund -> Wants). We net them out so
 * category spending reflects what was actually kept, never going below zero.
 *
 * Uncategorized is special: salary lands as Uncategorized income, so we never
 * subtract income there — we only count Uncategorized *expenses*.
 *
 * Both the dashboard (useBudget) and the reports page (buildReport) consume this
 * so their totals can never drift apart.
 */
export function getPeriodSpend(
  transactions: Transaction[],
  monthKey: string,
  paydayOfMonth = 1
): PeriodSpend {
  const { start, end } = getPeriodBounds(monthKey, paydayOfMonth);

  const inPeriod = (tx: Transaction) => {
    if (tx.excluded) return false;
    const d = new Date(tx.date + "T00:00:00");
    return d >= start && d <= end;
  };

  const expenses = transactions.filter((tx) => inPeriod(tx) && tx.type === "expense");
  const income = transactions.filter((tx) => inPeriod(tx) && tx.type === "income");

  const sumBy = (txs: Transaction[], cat: Category) =>
    txs.filter((t) => t.category === cat).reduce((s, t) => s + t.amount, 0);

  const netSpend = (cat: Category) => roundMoney(Math.max(0, sumBy(expenses, cat) - sumBy(income, cat)));

  const byCategory: Record<Category, number> = {
    Needs: netSpend("Needs"),
    Wants: netSpend("Wants"),
    Savings: netSpend("Savings"),
    // Income never erases real uncategorized spending.
    Uncategorized: roundMoney(sumBy(expenses, "Uncategorized")),
  };

  const total = roundMoney(
    byCategory.Needs + byCategory.Wants + byCategory.Savings + byCategory.Uncategorized
  );

  return { byCategory, total };
}
