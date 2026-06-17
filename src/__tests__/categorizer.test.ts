import { describe, it, expect } from "vitest";
import { matchCategory, applyCategorizationRules } from "@/lib/categorizer";
import type { Transaction, CategoryRule } from "@/types";

const rules: CategoryRule[] = [
  { keyword: "lidl", category: "Needs" },
  { keyword: "netflix", category: "Wants" },
  { keyword: "to eur savings", category: "Savings" },
];

function makeTx(id: string, description: string, type: "expense" | "income" = "expense"): Transaction {
  return {
    id,
    date: "2024-06-01",
    description,
    amount: 10,
    type,
    currency: "EUR",
    category: "Uncategorized",
    source: "revolut",
    categorySource: "auto",
  };
}

describe("matchCategory", () => {
  it("matches case-insensitively", () => {
    expect(matchCategory("LIDL Supermarket", rules)).toBe("Needs");
    expect(matchCategory("Netflix Monthly", rules)).toBe("Wants");
  });

  it("returns null when no rule matches", () => {
    expect(matchCategory("Unknown merchant", rules)).toBeNull();
  });

  it("matches substring", () => {
    expect(matchCategory("Transfer To EUR Savings Account", rules)).toBe("Savings");
  });
});

describe("applyCategorizationRules", () => {
  it("categorizes expenses by keyword", () => {
    const txs = [makeTx("1", "Lidl Market")];
    const [result] = applyCategorizationRules(txs, rules, {});
    expect(result.category).toBe("Needs");
    expect(result.categorySource).toBe("auto");
  });

  it("falls back to Wants for unmatched expenses", () => {
    const txs = [makeTx("1", "Random Shop")];
    const [result] = applyCategorizationRules(txs, rules, {});
    expect(result.category).toBe("Wants");
  });

  it("falls back to Uncategorized for unmatched income", () => {
    const txs = [makeTx("1", "Salary payment", "income")];
    const [result] = applyCategorizationRules(txs, rules, {});
    expect(result.category).toBe("Uncategorized");
  });

  it("explicit override wins over rules", () => {
    const txs = [makeTx("1", "Lidl Market")];
    const [result] = applyCategorizationRules(txs, rules, { "1": "Savings" });
    expect(result.category).toBe("Savings");
    expect(result.categorySource).toBe("override");
  });

  it("manual transactions keep their category unchanged", () => {
    const tx: Transaction = { ...makeTx("1", "Barber"), source: "manual", categorySource: "manual", category: "Needs" };
    const [result] = applyCategorizationRules([tx], rules, {});
    expect(result.category).toBe("Needs");
    expect(result.categorySource).toBe("manual");
  });
});
