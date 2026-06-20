import { describe, it, expect } from "vitest";
import { monthlyCategoryTotals, detectSubscriptions } from "@/lib/reports";
import { Transaction } from "@/types";

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
    ...partial,
  };
}

describe("monthlyCategoryTotals", () => {
  it("buckets by calendar month when payday is 1", () => {
    const totals = monthlyCategoryTotals(
      [tx({ amount: 50, type: "expense", category: "Wants", date: "2024-06-10" })],
      2024,
      1
    );
    expect(totals[5].wants).toBe(50); // June = index 5
    expect(totals[4].wants).toBe(0);
  });

  it("buckets by payday-aware period (payday 24)", () => {
    // Jun 10 belongs to the May period (May 24 – Jun 23); Jun 25 to the June period.
    const totals = monthlyCategoryTotals(
      [
        tx({ amount: 80, type: "expense", category: "Needs", date: "2024-06-10" }),
        tx({ amount: 20, type: "expense", category: "Needs", date: "2024-06-25" }),
      ],
      2024,
      24
    );
    expect(totals[4].needs).toBe(80); // May
    expect(totals[5].needs).toBe(20); // June
  });

  it("ignores excluded and income transactions", () => {
    const totals = monthlyCategoryTotals(
      [
        tx({ amount: 50, type: "expense", category: "Wants", date: "2024-06-10", excluded: true }),
        tx({ amount: 999, type: "income", category: "Wants", date: "2024-06-10" }),
      ],
      2024,
      1
    );
    expect(totals[5].wants).toBe(0);
  });

  it("monthlyCategoryTotals nets refunds the same way getPeriodSpend does", () => {
    const txs: Transaction[] = [
      { id: "1", date: "2024-03-15", description: "Shop", amount: 100, type: "expense", currency: "EUR", category: "Wants", source: "revolut", categorySource: "auto" },
      { id: "2", date: "2024-03-16", description: "Refund", amount: 30, type: "income", currency: "EUR", category: "Wants", source: "revolut", categorySource: "auto" },
    ];
    const totals = monthlyCategoryTotals(txs, 2024, 1);
    expect(totals[2].wants).toBe(70); // index 2 = March; net = max(0, 100 - 30)
  });
});

describe("detectSubscriptions", () => {
  it("detects a consistent monthly charge across multiple months", () => {
    const subs = detectSubscriptions([
      tx({ amount: 12.99, type: "expense", description: "Netflix", date: "2024-04-12" }),
      tx({ amount: 12.99, type: "expense", description: "Netflix", date: "2024-05-12" }),
      tx({ amount: 12.99, type: "expense", description: "Netflix", date: "2024-06-12" }),
    ]);
    expect(subs).toHaveLength(1);
    expect(subs[0].name).toBe("Netflix");
    expect(subs[0].amount).toBe(12.99);
    expect(subs[0].months).toBe(3);
    expect(subs[0].lastDate).toBe("2024-06-12");
  });

  it("ignores merchants with inconsistent (variable) amounts", () => {
    const subs = detectSubscriptions([
      tx({ amount: 30, type: "expense", description: "Lidl", date: "2024-04-03" }),
      tx({ amount: 55, type: "expense", description: "Lidl", date: "2024-05-09" }),
      tx({ amount: 12, type: "expense", description: "Lidl", date: "2024-06-21" }),
    ]);
    expect(subs).toHaveLength(0);
  });

  it("ignores merchants seen in only one month", () => {
    const subs = detectSubscriptions([
      tx({ amount: 9.99, type: "expense", description: "Spotify", date: "2024-06-01" }),
    ]);
    expect(subs).toHaveLength(0);
  });

  it("ignores excluded and income transactions", () => {
    const subs = detectSubscriptions([
      tx({ amount: 9.99, type: "expense", description: "Spotify", date: "2024-05-01", excluded: true }),
      tx({ amount: 9.99, type: "expense", description: "Spotify", date: "2024-06-01", excluded: true }),
      tx({ amount: 9.99, type: "income", description: "Spotify", date: "2024-04-01" }),
    ]);
    expect(subs).toHaveLength(0);
  });

  it("tolerates small price changes", () => {
    const subs = detectSubscriptions([
      tx({ amount: 12.99, type: "expense", description: "Netflix", date: "2024-04-12" }),
      tx({ amount: 13.99, type: "expense", description: "Netflix", date: "2024-05-12" }),
      tx({ amount: 12.99, type: "expense", description: "Netflix", date: "2024-06-12" }),
    ]);
    expect(subs).toHaveLength(1);
  });
});
