import { describe, it, expect } from "vitest";
import { filterInternalTransfers } from "@/lib/transfers";
import { Transaction } from "@/types";

let seq = 0;
function tx(partial: Partial<Transaction> & { type: Transaction["type"]; description: string }): Transaction {
  return {
    id: `t${seq++}`,
    date: "2024-06-10",
    amount: 10,
    currency: "EUR",
    category: "Wants",
    source: "revolut",
    categorySource: "auto",
    ...partial,
  };
}

describe("filterInternalTransfers", () => {
  it("drops self-transfers in both directions, case-insensitively", () => {
    const txs = [
      tx({ type: "income", description: "Transfer from Alexandros Christou" }),
      tx({ type: "expense", description: "ALEXANDROS CHRISTOU" }),
      tx({ type: "expense", description: "Lidl" }),
    ];
    const out = filterInternalTransfers(txs, { selfTransferKeywords: ["alexandros christou"] });
    expect(out).toHaveLength(1);
    expect(out[0].description).toBe("Lidl");
  });

  it("drops the positive savings-vault mirror but keeps the outgoing expense", () => {
    const txs = [
      tx({ type: "income", description: "EUR Savings vault" }),
      tx({ type: "expense", description: "To EUR Savings" }),
    ];
    const out = filterInternalTransfers(txs, { savingsVaultKeywords: ["eur savings"] });
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("expense");
  });

  it("matches on partial substrings", () => {
    const txs = [tx({ type: "income", description: "Savings for holiday" })];
    expect(filterInternalTransfers(txs, { savingsVaultKeywords: ["savings for"] })).toHaveLength(0);
  });

  it("keeps everything when no keywords are configured", () => {
    const txs = [
      tx({ type: "income", description: "Anything" }),
      tx({ type: "expense", description: "Else" }),
    ];
    expect(filterInternalTransfers(txs, {})).toHaveLength(2);
  });
});
