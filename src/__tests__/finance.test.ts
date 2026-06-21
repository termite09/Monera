import { describe, it, expect } from "vitest";
import { getPeriodSpend, netExpenseByCategory, netExpenseTotal } from "@/lib/finance";
import { useBudget } from "@/hooks/useBudget";
import { buildReport } from "@/lib/reports";
import { Transaction, Category, Settings } from "@/types";

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
function tx(partial: Partial<Transaction> & { amount: number; type: Transaction["type"] }): Transaction {
  return {
    id: `t${seq++}`,
    date: "2024-06-10",
    description: "x",
    currency: "EUR",
    category: "Wants",
    source: "revolut",
    categorySource: "auto",
    excluded: false,
    ...partial,
  };
}

describe("getPeriodSpend", () => {
  it("nets income-typed refunds against expenses in the same category", () => {
    const txs = [
      tx({ amount: 100, type: "expense", category: "Wants" }),
      tx({ amount: 30, type: "income", category: "Wants" }), // refund
    ];
    const spend = getPeriodSpend(txs, "2024-06", 1);
    expect(spend.byCategory.Wants).toBe(70);
    expect(spend.total).toBe(70);
  });

  it("delegates to the same netting as netExpenseByCategory (period-filtered)", () => {
    const txs = [
      tx({ amount: 100, type: "expense", category: "Wants" }),
      tx({ amount: 30, type: "income", category: "Wants" }),
    ];
    expect(getPeriodSpend(txs, "2024-06", 1).byCategory).toEqual(netExpenseByCategory(txs));
  });

  it("clamps a category at zero when refunds exceed spending", () => {
    const txs = [
      tx({ amount: 40, type: "expense", category: "Needs" }),
      tx({ amount: 100, type: "income", category: "Needs" }),
    ];
    expect(getPeriodSpend(txs, "2024-06", 1).byCategory.Needs).toBe(0);
  });

  it("counts Uncategorized expenses but never subtracts income (salary is Uncategorized)", () => {
    const txs = [
      tx({ amount: 25, type: "expense", category: "Uncategorized" }),
      tx({ amount: 2000, type: "income", category: "Uncategorized" }), // salary
    ];
    expect(getPeriodSpend(txs, "2024-06", 1).byCategory.Uncategorized).toBe(25);
  });

  it("ignores excluded transactions", () => {
    const txs = [
      tx({ amount: 50, type: "expense", category: "Needs" }),
      tx({ amount: 50, type: "expense", category: "Needs", excluded: true }),
    ];
    expect(getPeriodSpend(txs, "2024-06", 1).byCategory.Needs).toBe(50);
  });

  it("ignores transactions outside the payday-aware period", () => {
    // Payday 24th: period 2024-06 runs Jun 24 – Jul 23. Jun 10 is in the PREVIOUS period.
    const txs = [
      tx({ amount: 80, type: "expense", category: "Wants", date: "2024-06-10" }),
      tx({ amount: 20, type: "expense", category: "Wants", date: "2024-06-25" }),
    ];
    expect(getPeriodSpend(txs, "2024-06", 24).byCategory.Wants).toBe(20);
  });

  it("returns cent-clean totals despite floating-point drift", () => {
    const txs = [
      tx({ amount: 0.1, type: "expense", category: "Wants" }),
      tx({ amount: 0.2, type: "expense", category: "Wants" }),
    ];
    const spend = getPeriodSpend(txs, "2024-06", 1);
    expect(spend.byCategory.Wants).toBe(0.3);
    expect(spend.total).toBe(0.3);
  });

  it("total equals the sum of all category buckets", () => {
    const txs = [
      tx({ amount: 100, type: "expense", category: "Needs" }),
      tx({ amount: 50, type: "expense", category: "Wants" }),
      tx({ amount: 30, type: "expense", category: "Savings" }),
      tx({ amount: 10, type: "expense", category: "Uncategorized" }),
    ];
    const spend = getPeriodSpend(txs, "2024-06", 1);
    const cats: Category[] = ["Needs", "Wants", "Savings", "Uncategorized"];
    expect(spend.total).toBe(cats.reduce((s, c) => s + spend.byCategory[c], 0));
    expect(spend.total).toBe(190);
  });
});

describe("netExpenseByCategory / netExpenseTotal (period-agnostic)", () => {
  it("nets income-typed refunds against same-category expenses", () => {
    const txs = [
      tx({ amount: 100, type: "expense", category: "Wants" }),
      tx({ amount: 30, type: "income", category: "Wants" }), // refund
    ];
    expect(netExpenseTotal(txs)).toBe(70);
    expect(netExpenseByCategory(txs).Wants).toBe(70);
  });

  it("ignores excluded transactions", () => {
    const txs = [
      tx({ amount: 50, type: "expense", category: "Needs" }),
      tx({ amount: 50, type: "expense", category: "Needs", excluded: true }),
    ];
    expect(netExpenseTotal(txs)).toBe(50);
  });

  it("never subtracts income from Uncategorized (salary is Uncategorized)", () => {
    const txs = [
      tx({ amount: 25, type: "expense", category: "Uncategorized" }),
      tx({ amount: 2000, type: "income", category: "Uncategorized" }),
    ];
    expect(netExpenseByCategory(txs).Uncategorized).toBe(25);
    expect(netExpenseTotal(txs)).toBe(25);
  });

  it("does not apply any period filter (sums whatever it is given)", () => {
    const txs = [
      tx({ amount: 80, type: "expense", category: "Wants", date: "2024-01-01" }),
      tx({ amount: 20, type: "expense", category: "Wants", date: "2024-12-31" }),
    ];
    expect(netExpenseTotal(txs)).toBe(100);
  });
});

describe("useBudget income reconciliation (H2)", () => {
  it("adds detected income on top of configured income (additive, not override)", () => {
    const settings: Settings = {
      ...baseSettings,
      monthlyBudgets: {
        "2024-06": { month: "2024-06", income: 2000, budgetRule: { needs: 30, wants: 60, savings: 10 } },
      },
    };
    const txs = [tx({ amount: 500, type: "income", category: "Uncategorized" })];
    const { summary, incomeIsDetected } = useBudget(txs, settings, "2024-06");
    expect(summary.income).toBe(2500);
    expect(incomeIsDetected).toBe(true);
  });

  it("falls back to income detected in the statement when none is configured", () => {
    const txs = [
      tx({ amount: 1500, type: "income", category: "Uncategorized" }),
      tx({ amount: 200, type: "income", category: "Uncategorized" }),
    ];
    const { summary, incomeIsDetected } = useBudget(txs, baseSettings, "2024-06");
    expect(summary.income).toBe(1700);
    expect(incomeIsDetected).toBe(true);
  });

  it("is zero (not detected) when there is neither a configured nor a detected income", () => {
    const txs = [tx({ amount: 50, type: "expense", category: "Wants" })];
    const { summary, incomeIsDetected } = useBudget(txs, baseSettings, "2024-06");
    expect(summary.income).toBe(0);
    expect(incomeIsDetected).toBe(false);
  });

  it("adds detected income on top of defaultIncome (additive, not override)", () => {
    const settings: Settings = { ...baseSettings, defaultIncome: 2000 };
    const txs = [tx({ amount: 500, type: "income", category: "Uncategorized" })];
    const { summary, incomeIsDetected } = useBudget(txs, settings, "2024-06");
    expect(summary.income).toBe(2500);
    expect(incomeIsDetected).toBe(true);
  });

  it("per-period configured income overrides the standing defaultIncome", () => {
    const settings: Settings = {
      ...baseSettings,
      defaultIncome: 2000,
      monthlyBudgets: {
        "2024-06": { month: "2024-06", income: 3000, budgetRule: { needs: 30, wants: 60, savings: 10 } },
      },
    };
    const { summary } = useBudget([], settings, "2024-06");
    expect(summary.income).toBe(3000);
  });
});

describe("useBudget — salary double-counting", () => {
  const salarySettings: Settings = {
    ...baseSettings,
    defaultIncome: 3000,
    salaryKeywords: ["salary"],
    monthlyBudgets: {},
  };

  it("does not double-count salary when keyword matches CSV transaction", () => {
    const txs: Transaction[] = [
      tx({ amount: 3000, type: "income", description: "Monthly Salary", date: "2024-06-10", category: "Uncategorized" }),
      tx({ amount: 50, type: "income", description: "Freelance payment", date: "2024-06-12", category: "Uncategorized" }),
    ];
    const { summary } = useBudget(txs, salarySettings, "2024-06");
    // salary (3000 from settings) + freelance (50) = 3050, NOT 6050
    expect(summary.income).toBe(3050);
  });

  it("uses detectedIncome when no salary basis is configured", () => {
    const txs: Transaction[] = [
      tx({ amount: 2800, type: "income", description: "Wages", date: "2024-06-10", category: "Uncategorized" }),
    ];
    const { summary } = useBudget(txs, { ...baseSettings, monthlyBudgets: {} }, "2024-06");
    expect(summary.income).toBe(2800);
  });
});

describe("dashboard / reports consistency (C1)", () => {
  it("dashboard totalExpenses equals reports totalSpent when refunds exist", () => {
    const txs = [
      tx({ amount: 100, type: "expense", category: "Wants" }),
      tx({ amount: 35, type: "income", category: "Wants" }), // refund
      tx({ amount: 200, type: "expense", category: "Needs" }),
      tx({ amount: 2000, type: "income", category: "Uncategorized" }), // salary
    ];
    const { summary } = useBudget(txs, baseSettings, "2024-06");
    const report = buildReport(txs, "2024-06", 1);
    expect(summary.totalExpenses).toBe(report.totalSpent);
    expect(report.totalSpent).toBe(265); // (100-35) + 200, salary excluded
  });
});
