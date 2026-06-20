import { describe, it, expect } from "vitest";
import { deduplicateTransactions, mergeTransactions } from "@/lib/dedup";
import type { Transaction } from "@/types";

function makeTx(id: string, date: string, amount = 10): Transaction {
  return {
    id,
    date,
    description: `tx-${id}`,
    amount,
    type: "expense",
    currency: "EUR",
    category: "Wants",
    source: "revolut",
    categorySource: "auto",
    excluded: false,
  };
}

describe("deduplicateTransactions", () => {
  it("removes duplicate ids, keeps first occurrence", () => {
    const txs = [makeTx("a", "2024-06-01"), makeTx("a", "2024-06-01"), makeTx("b", "2024-06-02")];
    expect(deduplicateTransactions(txs)).toHaveLength(2);
  });

  it("returns all when no duplicates", () => {
    const txs = [makeTx("a", "2024-06-01"), makeTx("b", "2024-06-02")];
    expect(deduplicateTransactions(txs)).toHaveLength(2);
  });
});

describe("mergeTransactions", () => {
  it("sorts newest-first using ISO string comparison", () => {
    const revolut = [makeTx("r1", "2024-06-01"), makeTx("r2", "2024-06-15")];
    const manual = [makeTx("m1", "2024-06-10")];
    const merged = mergeTransactions(revolut, manual);
    expect(merged.map((t) => t.date)).toEqual(["2024-06-15", "2024-06-10", "2024-06-01"]);
  });

  it("deduplicates across both lists (revolut wins)", () => {
    const revolut = [makeTx("shared", "2024-06-01")];
    const manual = [makeTx("shared", "2024-06-01")];
    expect(mergeTransactions(revolut, manual)).toHaveLength(1);
  });
});
