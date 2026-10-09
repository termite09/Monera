import { Transaction, Settings, MonthSummary, Category } from "@/types";
import { buildReport, detectSubscriptions } from "@/lib/reports";
import { formatCurrency, getPeriodBounds } from "@/lib/utils";

export type InsightTone = "good" | "warn" | "info";

export interface Insight {
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
  budgetAllocations: { needs: number; wants: number; savings: number },
  now: Date = new Date()
): Insight[] {
  const money = (n: number) => formatCurrency(n);
  const { start, end } = getPeriodBounds(monthKey, settings.paydayOfMonth ?? 1);
  const running = now >= start && now <= end;
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
        text: `You've used ${Math.round((c.spent / c.alloc) * 100)}% of your ${c.key} budget, with ${money(c.alloc - c.spent)} left.`,
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

  // Spending vs last period — while a period is running, only up to the same day,
  // so day 16 is never weighed against a whole month. Savings aren't spending.
  const report = buildReport(transactions, monthKey, payday, now);
  const spentNow = report.totalSpent - (report.byCategory.find((c) => c.category === "Savings")?.total ?? 0);
  const spentBefore = report.prevTotal - report.prevByCategory.Savings;
  if (spentNow > 0 && spentBefore > 0) {
    const diff = spentNow - spentBefore;
    const when = report.comparedToSamePoint ? "by this point last period" : "last period";
    if (Math.abs(diff) / spentBefore < 0.05) {
      out.push({ id: "vs-last", tone: "info", text: `You've spent about the same as ${when}.` });
    } else {
      out.push({
        id: "vs-last",
        tone: diff < 0 ? "good" : "warn",
        text: `You've spent ${money(Math.abs(diff))} ${diff < 0 ? "less" : "more"} than ${when}.`,
      });
    }
  }

  // Savings rate.
  if (summary.income > 0 && summary.savings > 0) {
    const rate = Math.round((summary.savings / summary.income) * 100);
    out.push({
      id: "savings-rate",
      tone: rate >= 20 ? "good" : "info",
      text: running
        ? `You've saved ${rate}% of your income so far this period.`
        : `You saved ${rate}% of your income this period.`,
    });
  }

  // Recurring subscription load (across all history).
  const subs = detectSubscriptions(transactions).filter(
    (s) => !(settings.excludedSubscriptions ?? []).includes(s.name)
  );
  if (subs.length > 0) {
    const monthly = subs.reduce((s, x) => s + x.amount, 0);
    out.push({ id: "subs", tone: "info", text: `${subs.length} subscription${subs.length === 1 ? "" : "s"} cost about ${money(monthly)} each pay period.` });
  }

  // Warnings first, then wins, then neutral info; cap to keep it scannable.
  const rank: Record<InsightTone, number> = { warn: 0, good: 1, info: 2 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 5);
}
