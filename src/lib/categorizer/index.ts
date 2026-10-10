import { Category, CategoryRule, Transaction } from "@/types";

/**
 * Applies category overrides and keyword rules. An explicit override always
 * wins; manual entries keep the category the user picked; otherwise the first
 * matching rule decides. Unmatched income stays Uncategorized (salary must never
 * pollute a spending category) and unmatched expenses fall back to Wants.
 */
export function applyCategorizationRules(
  transactions: Transaction[],
  rules: CategoryRule[],
  overrides: Record<string, Category>
): Transaction[] {
  // Lowercase rule keywords once per call instead of once per transaction.
  const lowered = rules.map((r) => ({ keyword: r.keyword.toLowerCase(), category: r.category }));

  return transactions.map((tx) => {
    if (overrides[tx.id]) {
      return { ...tx, category: overrides[tx.id], categorySource: "override" };
    }
    if (tx.categorySource === "manual") return tx;

    const description = tx.description.toLowerCase();
    const matched = lowered.find((r) => description.includes(r.keyword))?.category;
    const category: Category = matched ?? (tx.type === "income" ? "Uncategorized" : "Wants");
    return { ...tx, category, categorySource: "auto" as const };
  });
}
