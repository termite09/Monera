import { Transaction, Settings, MonthSummary, Category } from "@/types";
import { getPeriodSpend } from "@/lib/finance";
import { detectSubscriptions } from "@/lib/reports";
import { formatCurrency, getPrevMonthKey } from "@/lib/utils";

type InsightTone = "good" | "warn" | "info";

interface Insight {
  id: string;
  text: string;
  tone: InsightTone;
}

/**
 * Turns the period's numbers into a short, prioritized list of plain-language
 * callouts. Pure function over data the app already computes (summary +
 * allocations from useBudget, plus transaction history) — no new storage, no
 * backend. Warnings surface first, then wins, then neutral info.
 */
export function buildInsights(
  transactions: Transaction[],
  settings: Settings,
  monthKey: string,
  summary: MonthSummary,
  budgetAllocations: { needs: number; wants: number; savings: number }
): Insight[] {
  const money = (n: number) => formatCurrency(n, settings.currency);
  const payday = settings.paydayOfMonth ?? 1;
  const out: Insight[] = [];

  // Budget pressure on the two spending categories (over-saving is good, handled below).
  const spendCats: { key: Category; alloc: number; spent: number }[] = [
    { key: "Needs", alloc: budgetAllocations.needs, spent: summary.needs },
    { key: "Wants", alloc: budgetAllocations.wants, spent: summary.wants },
  ];
  for (const c of spendCats) {
    if (c.alloc <= 0) continue;
    if (c.spent > c.alloc) {
      out.push({ id: `over-${c.key}`, tone: "warn", text: `You're ${money(c.spent - c.alloc)} over your ${c.key} budget.` });
    } else if (c.spent / c.alloc >= 0.85) {
      out.push({
        id: `near-${c.key}`,
        tone: "warn",
        text: `You've used ${Math.round((c.spent / c.alloc) * 100)}% of your ${c.key} budget — ${money(c.alloc - c.spent)} left.`,
      });
    }
  }

  // Spending exceeded income this period.
  if (summary.remaining < 0) {
    out.push({ id: "overspent", tone: "warn", text: `You've spent ${money(-summary.remaining)} more than your income this period.` });
  }

  // Reaching the savings target is a win.
  if (budgetAllocations.savings > 0 && summary.savings >= budgetAllocations.savings) {
    out.push({ id: "savings-target", tone: "good", text: `You hit your savings target of ${money(budgetAllocations.savings)}.` });
  }

  // Spending vs the previous period.
  const prevTotal = getPeriodSpend(transactions, getPrevMonthKey(monthKey), payday).total;
  if (prevTotal > 0) {
    const change = Math.round(((summary.totalExpenses - prevTotal) / prevTotal) * 100);
    if (change !== 0) {
      out.push({
        id: "vs-last",
        tone: change > 0 ? "warn" : "good",
        text: `Spending is ${Math.abs(change)}% ${change > 0 ? "higher" : "lower"} than last period.`,
      });
    }
  }

  // Savings rate.
  if (summary.income > 0 && summary.savings > 0) {
    const rate = Math.round((summary.savings / summary.income) * 100);
    out.push({
      id: "savings-rate",
      tone: rate >= 20 ? "good" : "info",
      text: `You saved ${rate}% of your income this period.`,
    });
  }

  // Recurring subscription load (across all history).
  const subs = detectSubscriptions(transactions).filter(
    (s) => !(settings.excludedSubscriptions ?? []).includes(s.name)
  );
  if (subs.length > 0) {
    const monthly = subs.reduce((s, x) => s + x.amount, 0);
    out.push({ id: "subs", tone: "info", text: `${subs.length} subscription${subs.length === 1 ? "" : "s"} cost about ${money(monthly)}/month.` });
  }

  // Warnings first, then wins, then neutral info; cap to keep it scannable.
  const rank: Record<InsightTone, number> = { warn: 0, good: 1, info: 2 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 5);
}
