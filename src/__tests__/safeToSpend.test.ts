import { describe, it, expect } from "vitest";
import { computeSafeToSpend } from "@/lib/safeToSpend";
import { Transaction, Settings, MonthSummary } from "@/types";

const baseSettings: Settings = {
  currency: "€",
  paydayOfMonth: 1,
  defaultBudgetRule: { needs: 30, wants: 60, savings: 10 },
  monthlyBudgets: {},
  salaryKeywords: [],
  selfTransferKeywords: [],
  savingsVaultKeywords: [],
  recurringPayments: [],
};

let seq = 0;
function tx(partial: Partial<Transaction> & { amount: number; type: Transaction["type"]; date: string }): Transaction {
  return {
    id: `t${seq++}`,
    description: "x",
    currency: "EUR",
    category: "Wants",
    source: "revolut",
    categorySource: "auto",
    excluded: false,
    ...partial,
  };
}

function summaryWith(income: number): MonthSummary {
  return { income, totalExpenses: 0, needs: 0, wants: 0, savings: 0, remaining: 0 };
}

// Payday 1 → "2024-06" runs Jun 1 – Jun 30. "now" sits mid-period.
const NOW = new Date("2024-06-15T12:00:00");

describe("computeSafeToSpend", () => {
  it("sums income minus spend, savings, and upcoming payments (with refund netting)", () => {
    const txs = [
      tx({ amount: 100, type: "expense", category: "Needs", date: "2024-06-05" }),
      tx({ amount: 200, type: "expense", category: "Wants", date: "2024-06-10" }),
      tx({ amount: 30, type: "income", category: "Wants", date: "2024-06-12" }), // refund → Wants nets to 170
      tx({ amount: 80, type: "expense", category: "Savings", date: "2024-06-08" }),
      tx({ amount: 50, type: "expense", category: "Needs", date: "2024-06-25", description: "Netflix" }), // upcoming bill
    ];
    const r = computeSafeToSpend(txs, baseSettings, "2024-06", summaryWith(2000), NOW);

    expect(r.applicable).toBe(true);
    expect(r.spentSoFar).toBe(270); // 100 + (200 − 30)
    expect(r.savedSoFar).toBe(80);
    expect(r.billsDue).toBe(50);
    expect(r.billItems).toEqual([{ name: "Netflix", amount: 50, date: "2024-06-25", source: "revolut", category: "Needs" }]);
    expect(r.safe).toBe(1600); // 2000 − 270 − 80 − 50
    expect(r.daysLeft).toBeGreaterThan(0);
  });

  it("is not applicable for a period that doesn't contain today", () => {
    const r = computeSafeToSpend([], baseSettings, "2024-06", summaryWith(2000), new Date("2024-08-15T12:00:00"));
    expect(r.applicable).toBe(false);
    expect(r.reason).toBe("not-current-period");
  });

  it("is not applicable when there is no income", () => {
    const r = computeSafeToSpend([], baseSettings, "2024-06", summaryWith(0), NOW);
    expect(r.applicable).toBe(false);
    expect(r.reason).toBe("no-income");
  });

  it("excludes future spend from spentSoFar and counts it as payments due", () => {
    const txs = [
      tx({ amount: 40, type: "expense", category: "Wants", date: "2024-06-14" }), // incurred
      tx({ amount: 60, type: "expense", category: "Wants", date: "2024-06-20", description: "Gym" }), // upcoming
    ];
    const r = computeSafeToSpend(txs, baseSettings, "2024-06", summaryWith(1000), NOW);
    expect(r.spentSoFar).toBe(40);
    expect(r.billsDue).toBe(60);
    expect(r.safe).toBe(900); // 1000 − 40 − 0 − 60
  });
});
