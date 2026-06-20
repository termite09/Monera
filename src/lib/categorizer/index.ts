import { Category, CategoryRule, Transaction } from "@/types";

const STOP_WORDS = new Set([
  "the", "a", "at", "ltd", "co", "plc", "inc", "for", "and", "to", "of", "from",
]);

export function extractMerchantKeyword(description: string): string | null {
  const cleaned = description
    .toLowerCase()
    .replace(/\d/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
  if (!words.length) return null;
  return words.reduce((a, b) => (a.length >= b.length ? a : b));
}

interface LoweredRule {
  kw: string;
  category: Category;
}

function matchLowered(lowerDesc: string, lowered: LoweredRule[]): Category | null {
  for (const r of lowered) {
    if (lowerDesc.includes(r.kw)) return r.category;
  }
  return null;
}

// Returns the matched category, or null when no rule matches.
export function matchCategory(
  description: string,
  rules: CategoryRule[]
): Category | null {
  return matchLowered(
    description.toLowerCase(),
    rules.map((r) => ({ kw: r.keyword.toLowerCase(), category: r.category }))
  );
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
  // Lowercase rule keywords once per call instead of once per transaction.
  const lowered: LoweredRule[] = rules.map((r) => ({
    kw: r.keyword.toLowerCase(),
    category: r.category,
  }));

  return transactions.map((tx) => {
    // An explicit user override always wins.
    if (overrides[tx.id]) {
      return { ...tx, category: overrides[tx.id], categorySource: "override" };
    }
    // Manually entered transactions keep the category the user picked and are
    // never re-derived from rules.
    if (tx.categorySource === "manual") return tx;

    const matched = matchLowered(tx.description.toLowerCase(), lowered);
    // Unmatched income (salary, generic transfers) stays Uncategorized so it
    // never pollutes a spending category. Unmatched expenses fall back to Wants.
    const category: Category = matched ?? (tx.type === "income" ? "Uncategorized" : "Wants");
    return { ...tx, category, categorySource: "auto" as const };
  });
}
