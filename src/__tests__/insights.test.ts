import { describe, it, expect } from "vitest";
import { buildInsights } from "@/lib/insights";
import { Transaction, Settings, MonthSummary } from "@/types";

const settings: Settings = {
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
function tx(p: Partial<Transaction> & { amount: number; type: Transaction["type"] }): Transaction {
  return {
    id: `t${seq++}`,
    date: "2024-06-10",
    description: "x",
    currency: "EUR",
    category: "Wants",
    source: "revolut",
    categorySource: "auto",
    ...p,
  };
}

function summaryOf(p: Partial<MonthSummary>): MonthSummary {
  return { income: 0, transfersReceived: 0, totalExpenses: 0, needs: 0, wants: 0, savings: 0, remaining: 0, ...p };
}

const noAlloc = { needs: 0, wants: 0, savings: 0 };

describe("buildInsights", () => {
  it("warns when a spending category is over budget", () => {
    const summary = summaryOf({ income: 1000, wants: 700, totalExpenses: 700, remaining: 300 });
    const ins = buildInsights([], settings, "2024-06", summary, { needs: 300, wants: 600, savings: 100 });
    expect(ins.find((i) => i.id === "over-Wants")?.tone).toBe("warn");
  });

  it("flags a healthy savings rate as good", () => {
    const summary = summaryOf({ income: 2000, savings: 400, totalExpenses: 400, remaining: 1600 });
    const ins = buildInsights([], settings, "2024-06", summary, { needs: 600, wants: 1200, savings: 200 });
    expect(ins.find((i) => i.id === "savings-rate")?.tone).toBe("good");
  });

  it("reports detected subscriptions", () => {
    const subsTx = [
      tx({ amount: 9.99, type: "expense", description: "Spotify", date: "2024-04-01" }),
      tx({ amount: 9.99, type: "expense", description: "Spotify", date: "2024-05-01" }),
      tx({ amount: 9.99, type: "expense", description: "Spotify", date: "2024-06-01" }),
    ];
    const ins = buildInsights(subsTx, settings, "2024-06", summaryOf({ income: 1000 }), noAlloc);
    expect(ins.some((i) => i.id === "subs")).toBe(true);
  });

  it("celebrates when spending drops vs last period", () => {
    const txs = [
      tx({ amount: 50, type: "expense", category: "Wants", date: "2024-06-10" }),
      tx({ amount: 100, type: "expense", category: "Wants", date: "2024-05-10" }),
    ];
    const summary = summaryOf({ income: 1000, wants: 50, totalExpenses: 50, remaining: 950 });
    const ins = buildInsights(txs, settings, "2024-06", summary, { needs: 300, wants: 600, savings: 100 });
    expect(ins.find((i) => i.id === "vs-last")?.tone).toBe("good");
  });

  it("warns when spending exceeds income", () => {
    const summary = summaryOf({ income: 1000, totalExpenses: 1200, remaining: -200 });
    const ins = buildInsights([], settings, "2024-06", summary, noAlloc);
    expect(ins.find((i) => i.id === "overspent")?.tone).toBe("warn");
  });

  it("returns nothing actionable for an empty, unconfigured period", () => {
    const ins = buildInsights([], settings, "2024-06", summaryOf({}), noAlloc);
    expect(ins).toHaveLength(0);
  });
});
