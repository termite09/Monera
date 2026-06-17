import { Category, CategoryRule, Transaction } from "@/types";

export function categorizeTransaction(
  description: string,
  rules: CategoryRule[]
): { category: Category; categorySource: "auto" | "override" } {
  const lower = description.toLowerCase();

  for (const rule of rules) {
    if (lower.includes(rule.keyword.toLowerCase())) {
      return { category: rule.category, categorySource: "auto" };
    }
  }

  // Default unmatched transactions to Wants
  return { category: "Wants", categorySource: "auto" };
}

export function applyCategorizationRules(
  transactions: Transaction[],
  rules: CategoryRule[],
  overrides: Record<string, Category>
): Transaction[] {
  return transactions.map((tx) => {
    if (overrides[tx.id]) {
      return { ...tx, category: overrides[tx.id], categorySource: "override" };
    }

    const { category, categorySource } = categorizeTransaction(tx.description, rules);
    return { ...tx, category, categorySource };
  });
}
