import { describe, it, expect } from "vitest";
import { mergeTransactions } from "@/lib/dedup";
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
    source: "statement",
    categorySource: "auto",
    excluded: false,
  };
}

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

  it("drops the copy of a transaction that appears in two statements", () => {
    const tx = makeTx("a", "2024-06-01");
    expect(mergeTransactions([tx, { ...tx }], [])).toHaveLength(1);
  });

  it("keeps different transactions whose ids collide, giving one a new id", () => {
    const first = makeTx("same", "2024-06-01", 10);
    const second = { ...makeTx("same", "2024-06-02", 25), description: "something else" };
    const merged = mergeTransactions([first, second], []);
    expect(merged).toHaveLength(2);
    expect(new Set(merged.map((t) => t.id)).size).toBe(2);
  });

  it("decides which colliding transaction keeps the id regardless of order", () => {
    const first = makeTx("same", "2024-06-01", 10);
    const second = { ...makeTx("same", "2024-06-02", 25), description: "something else" };
    const idsOf = (txs: Transaction[]) => Object.fromEntries(txs.map((t) => [t.date, t.id]));
    expect(idsOf(mergeTransactions([first, second], []))).toEqual(idsOf(mergeTransactions([second, first], [])));
  });
});
