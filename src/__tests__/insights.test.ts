import { describe, it, expect } from "vitest";
import { periodTotalsForYear, detectSubscriptions, buildPeriodInsights, groupByMerchant } from "@/lib/insights";
import { Transaction } from "@/types";

let seq = 0;
function tx(partial: Partial<Transaction> & { amount: number; type: Transaction["type"] }): Transaction {
  return {
    id: `t${seq++}`,
    date: "2024-06-10",
    description: "x",
    currency: "EUR",
    category: "Wants",
    source: "statement",
    categorySource: "auto",
    excluded: false,
    ...partial,
  };
}

describe("periodTotalsForYear", () => {
  it("buckets by calendar month when payday is 1", () => {
    const totals = periodTotalsForYear(
      [tx({ amount: 50, type: "expense", category: "Wants", date: "2024-06-10" })],
      2024,
      1
    );
    expect(totals[5].wants).toBe(50); // June = index 5
    expect(totals[4].wants).toBe(0);
  });

  it("buckets by payday-aware period (payday 24)", () => {
    // Jun 10 belongs to the May period (May 24 – Jun 23); Jun 25 to the June period.
    const totals = periodTotalsForYear(
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
    const totals = periodTotalsForYear(
      [
        tx({ amount: 50, type: "expense", category: "Wants", date: "2024-06-10", excluded: true }),
        tx({ amount: 999, type: "income", category: "Wants", date: "2024-06-10" }),
      ],
      2024,
      1
    );
    expect(totals[5].wants).toBe(0);
  });

  it("periodTotalsForYear nets refunds the same way getPeriodSpend does", () => {
    const txs: Transaction[] = [
      { id: "1", date: "2024-03-15", description: "Shop", amount: 100, type: "expense", currency: "EUR", category: "Wants", source: "statement", categorySource: "auto", excluded: false },
      { id: "2", date: "2024-03-16", description: "Refund", amount: 30, type: "income", currency: "EUR", category: "Wants", source: "statement", categorySource: "auto", excluded: false },
    ];
    const totals = periodTotalsForYear(txs, 2024, 1);
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

describe("buildPeriodInsights — fair comparison", () => {
  // Payday 1: June period is 1–30 June; "now" is 10 June (day 10).
  const now = new Date(2024, 5, 10, 12);

  it("compares a running period with last period only up to the same day", () => {
    const txs = [
      tx({ amount: 100, type: "expense", category: "Wants", date: "2024-06-05" }),
      tx({ amount: 80, type: "expense", category: "Wants", date: "2024-05-05" }), // same point last period
      tx({ amount: 500, type: "expense", category: "Wants", date: "2024-05-25" }), // later in last period
    ];
    const report = buildPeriodInsights(txs, "2024-06", 1, now);
    expect(report.comparedToSamePoint).toBe(true);
    expect(report.prevSpending).toBe(80);
  });

  it("compares whole periods once the period has ended", () => {
    const txs = [
      tx({ amount: 80, type: "expense", category: "Wants", date: "2024-05-05" }),
      tx({ amount: 500, type: "expense", category: "Wants", date: "2024-05-25" }),
    ];
    const report = buildPeriodInsights(txs, "2024-06", 1, new Date(2024, 6, 15));
    expect(report.comparedToSamePoint).toBe(false);
    expect(report.prevSpending).toBe(580);
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

describe("buildPeriodInsights — spending", () => {
  const now = new Date(2024, 5, 10, 12);
  it("reports spending without savings", () => {
    const txs = [
      tx({ amount: 100, type: "expense", category: "Wants", date: "2024-06-05" }),
      tx({ amount: 150, type: "expense", category: "Savings", date: "2024-06-02" }),
    ];
    const r = buildPeriodInsights(txs, "2024-06", 1, now);
    expect(r.totalSpent).toBe(250);
    expect(r.spending).toBe(100);
  });
});

describe("detectSubscriptions — rhythm", () => {
  it("marks a charge every other month as bi-monthly, with its merchant key", () => {
    const subs = detectSubscriptions([
      tx({ amount: 60, type: "expense", description: "Car insurance", date: "2024-01-15" }),
      tx({ amount: 60, type: "expense", description: "Car insurance", date: "2024-03-15" }),
      tx({ amount: 60, type: "expense", description: "Car insurance", date: "2024-05-15" }),
    ]);
    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject({ key: "car insurance", everyMonths: 2, lastDate: "2024-05-15" });
  });
});

describe("groupByMerchant", () => {
  it("groups reference-numbered descriptions together, biggest total first", () => {
    const groups = groupByMerchant([
      tx({ amount: 10, type: "expense", description: "Wolt 123456", date: "2024-06-01" }),
      tx({ amount: 15, type: "expense", description: "Wolt 987654", date: "2024-06-03" }),
      tx({ amount: 30, type: "expense", description: "Lidl", date: "2024-06-02" }),
    ]);
    expect(groups.map((g) => [g.key, g.total, g.count])).toEqual([["lidl", 30, 1], ["wolt", 25, 2]]);
    expect(groups[1].transactions.map((t) => t.date)).toEqual(["2024-06-03", "2024-06-01"]);
  });
});

describe("periodTotalsForYear — payday periods", () => {
  it("files a transaction under the period it falls in, not its calendar month", () => {
    // Payday 24: 10 June belongs to the period that started 24 May ("2024-05").
    const totals = periodTotalsForYear([tx({ amount: 40, type: "expense", category: "Needs", date: "2024-06-10" })], 2024, 24);
    expect(totals[4].needs).toBe(40);
    expect(totals[5].needs).toBe(0);
  });
});
