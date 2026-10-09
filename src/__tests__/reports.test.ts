import { describe, it, expect } from "vitest";
import { monthlyCategoryTotals, detectSubscriptions, buildReport } from "@/lib/reports";
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
    excluded: false,
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
      { id: "1", date: "2024-03-15", description: "Shop", amount: 100, type: "expense", currency: "EUR", category: "Wants", source: "revolut", categorySource: "auto", excluded: false },
      { id: "2", date: "2024-03-16", description: "Refund", amount: 30, type: "income", currency: "EUR", category: "Wants", source: "revolut", categorySource: "auto", excluded: false },
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

  it("rounds the representative (median) amount to clean cents", () => {
    // Even-count charges: raw median (12.99 + 13.49) / 2 = 13.2399999… without
    // rounding. The representative amount must be a clean 13.24.
    const subs = detectSubscriptions([
      tx({ amount: 12.99, type: "expense", description: "Disney", date: "2024-03-12" }),
      tx({ amount: 12.99, type: "expense", description: "Disney", date: "2024-04-12" }),
      tx({ amount: 13.49, type: "expense", description: "Disney", date: "2024-05-12" }),
      tx({ amount: 13.49, type: "expense", description: "Disney", date: "2024-06-12" }),
    ]);
    expect(subs).toHaveLength(1);
    expect(subs[0].amount).toBe(13.24);
  });
});

describe("detectSubscriptions — only optional spending", () => {
  it("ignores regular rent (Needs) and savings transfers, keeps a streaming charge", () => {
    const months = ["2024-03-02", "2024-04-02", "2024-05-02"];
    const txs = months.flatMap((date) => [
      tx({ amount: 780, type: "expense", category: "Needs", description: "Landlord rent", date }),
      tx({ amount: 150, type: "expense", category: "Savings", description: "To EUR Savings", date }),
      tx({ amount: 12.99, type: "expense", category: "Wants", description: "Netflix", date }),
    ]);
    const names = detectSubscriptions(txs).map((s) => s.name);
    expect(names).toEqual(["Netflix"]);
  });
});

describe("buildReport — fair comparison and projection", () => {
  // Payday 1: June period is 1–30 June; "now" is 10 June (day 10).
  const now = new Date(2024, 5, 10, 12);

  it("compares a running period with last period only up to the same day", () => {
    const txs = [
      tx({ amount: 100, type: "expense", category: "Wants", date: "2024-06-05" }),
      tx({ amount: 80, type: "expense", category: "Wants", date: "2024-05-05" }), // same point last period
      tx({ amount: 500, type: "expense", category: "Wants", date: "2024-05-25" }), // later in last period
    ];
    const report = buildReport(txs, "2024-06", 1, now);
    expect(report.comparedToSamePoint).toBe(true);
    expect(report.prevTotal).toBe(80);
  });

  it("compares whole periods once the period has ended", () => {
    const txs = [
      tx({ amount: 80, type: "expense", category: "Wants", date: "2024-05-05" }),
      tx({ amount: 500, type: "expense", category: "Wants", date: "2024-05-25" }),
    ];
    const report = buildReport(txs, "2024-06", 1, new Date(2024, 6, 15));
    expect(report.comparedToSamePoint).toBe(false);
    expect(report.prevTotal).toBe(580);
  });

  it("projects only day-to-day spending forward, not rent or savings", () => {
    const history = ["2024-03-01", "2024-04-01", "2024-05-01"].map((date) =>
      tx({ amount: 780, type: "expense", category: "Needs", description: "Landlord rent", date })
    );
    const txs = [
      ...history,
      tx({ amount: 780, type: "expense", category: "Needs", description: "Landlord rent", date: "2024-06-01" }),
      tx({ amount: 150, type: "expense", category: "Savings", description: "To EUR Savings", date: "2024-06-01" }),
      tx({ amount: 100, type: "expense", category: "Wants", description: "Groceries", date: "2024-06-05" }),
    ];
    const report = buildReport(txs, "2024-06", 1, now);
    // Spent so far excl. savings = 880; day-to-day = 100 over 10 days → +10/day × 20 days left.
    expect(report.projectedTotal).toBe(1080);
  });
});

describe("detectSubscriptions — steady prices only", () => {
  it("ignores a shop whose amount changes every month", () => {
    const subs = detectSubscriptions([
      tx({ amount: 74.18, type: "expense", description: "Amazon", date: "2024-04-07" }),
      tx({ amount: 70.95, type: "expense", description: "Amazon", date: "2024-05-07" }),
      tx({ amount: 64.5, type: "expense", description: "Amazon", date: "2024-06-07" }),
    ]);
    expect(subs).toHaveLength(0);
  });
});

describe("buildReport — spending and projection", () => {
  const now = new Date(2024, 5, 10, 12);
  it("reports spending without savings", () => {
    const txs = [
      tx({ amount: 100, type: "expense", category: "Wants", date: "2024-06-05" }),
      tx({ amount: 150, type: "expense", category: "Savings", date: "2024-06-02" }),
    ];
    const r = buildReport(txs, "2024-06", 1, now);
    expect(r.totalSpent).toBe(250);
    expect(r.spending).toBe(100);
  });

  it("adds known upcoming spending to the projection", () => {
    const txs = [tx({ amount: 100, type: "expense", category: "Wants", description: "Groceries", date: "2024-06-05" })];
    const without = buildReport(txs, "2024-06", 1, now).projectedTotal;
    expect(buildReport(txs, "2024-06", 1, now, 129).projectedTotal).toBe(without + 129);
  });
});

describe("buildReport — pace by budget", () => {
  it("splits the everyday pace into Needs and Wants (unsorted counts as Wants)", () => {
    const now = new Date(2024, 5, 10, 12);
    const txs = [
      tx({ amount: 100, type: "expense", category: "Needs", description: "Groceries", date: "2024-06-05" }),
      tx({ amount: 50, type: "expense", category: "Uncategorized", description: "Misc", date: "2024-06-06" }),
    ];
    const r = buildReport(txs, "2024-06", 1, now);
    expect(r.projectedPaceBy.Needs + r.projectedPaceBy.Wants).toBeCloseTo(r.projectedPace, 1);
    expect(r.projectedPaceBy.Wants).toBeGreaterThan(0);
  });
});
