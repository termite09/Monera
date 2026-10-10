import { Transaction, Category } from "@/types";
import { getPeriodRange, inRange, roundMoney } from "@/lib/utils";

export interface PeriodSpend {
  byCategory: Record<Category, number>;
  total: number;
}

/**
 * The single source of truth for how much was *spent*, over an ARBITRARY set of
 * transactions — the caller decides the scope (a payday period, a custom date
 * range, a search result).
 *
 * Refunds arrive as income-typed transactions categorized to the same bucket as
 * the original purchase (e.g. an AlphaMega refund -> Wants). We net them out so
 * category spending reflects what was actually kept, never going below zero.
 *
 * Uncategorized is special: salary lands as Uncategorized income, so we never
 * subtract income there — we only count Uncategorized *expenses*.
 */
export function netExpenseByCategory(transactions: Transaction[]): Record<Category, number> {
  const spent: Record<Category, number> = { Needs: 0, Wants: 0, Savings: 0, Uncategorized: 0 };
  const refunded: Record<Category, number> = { Needs: 0, Wants: 0, Savings: 0, Uncategorized: 0 };
  for (const tx of transactions) {
    if (tx.excluded) continue;
    (tx.type === "expense" ? spent : refunded)[tx.category] += tx.amount;
  }
  const net = (cat: Category) => roundMoney(Math.max(0, spent[cat] - refunded[cat]));
  return {
    Needs: net("Needs"),
    Wants: net("Wants"),
    Savings: net("Savings"),
    // Income never erases real uncategorized spending (salary lands here).
    Uncategorized: roundMoney(spent.Uncategorized),
  };
}

function sumCategories(b: Record<Category, number>): number {
  return roundMoney(b.Needs + b.Wants + b.Savings + b.Uncategorized);
}

/** Net expense total over an arbitrary set of transactions (see netExpenseByCategory). */
export function netExpenseTotal(transactions: Transaction[]): number {
  return sumCategories(netExpenseByCategory(transactions));
}

/** Net spending within one pay period. The dashboard and Insights both use this so they never disagree. */
export function getPeriodSpend(transactions: Transaction[], periodKey: string, paydayOfMonth = 1): PeriodSpend {
  const range = getPeriodRange(periodKey, paydayOfMonth);
  const byCategory = netExpenseByCategory(transactions.filter((tx) => inRange(tx.date, range)));
  return { byCategory, total: sumCategories(byCategory) };
}
