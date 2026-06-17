import { Category, CategoryRule, Transaction } from "@/types";

// Returns the matched category, or null when no rule matches.
export function matchCategory(
  description: string,
  rules: CategoryRule[]
): Category | null {
  const lower = description.toLowerCase();
  for (const rule of rules) {
    if (lower.includes(rule.keyword.toLowerCase())) {
      return rule.category;
    }
  }
  return null;
}

export function categorizeTransaction(
  description: string,
  rules: CategoryRule[]
): { category: Category; categorySource: "auto" | "override" } {
  const matched = matchCategory(description, rules);
  // Default unmatched expenses to Wants
  return { category: matched ?? "Wants", categorySource: "auto" };
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

    const matched = matchCategory(tx.description, rules);
    // Unmatched income (salary, generic transfers) stays Uncategorized so it
    // never pollutes a spending category. Unmatched expenses fall back to Wants.
    const category: Category = matched ?? (tx.type === "income" ? "Uncategorized" : "Wants");
    return { ...tx, category, categorySource: "auto" as const };
  });
}
