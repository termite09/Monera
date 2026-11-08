import { Category, CategoryRule, Transaction } from "@/types";

export interface CategorizeOptions {
  /** Money moved to savings or investments ("To EUR Savings…", "To investment account"): counted as Savings. */
  savingsKeywords?: string[];
  /** Money in from other people reduces Wants spending instead of counting as income. */
  repaymentsReduceSpending?: boolean;
  /** Descriptions identifying pay, which always stays income. */
  salaryKeywords?: string[];
}

const REFUND_LOOKBACK_DAYS = 90;
const DAY_MS = 86_400_000;

function matchesAny(description: string, keywords: string[] = []): boolean {
  return keywords.some((k) => k.trim() !== "" && description.includes(k.trim().toLowerCase()));
}

/** The user's saved category for a transaction, under its id or one it had in another export. */
function overrideFor(tx: Transaction, overrides: Record<string, Category>): Category | undefined {
  return overrides[tx.id] ?? tx.aliases?.map((id) => overrides[id]).find(Boolean);
}

/**
 * Applies category overrides and keyword rules. An explicit override always
 * wins; manual entries keep the category the user picked; otherwise the first
 * matching rule decides, then:
 *  - money moved to savings or investments counts as Savings (a vault move
 *    recognised by its mirror row, or a description matching a savings keyword);
 *  - a refund takes the category of the purchase it pays back (the latest
 *    purchase of the same amount before it), so it nets against that spending
 *    instead of counting as income;
 *  - money in from other people reduces Wants, when the user has said so;
 *  - other income stays Uncategorized (salary must never pollute a spending
 *    category) and other spending falls back to Wants.
 */
export function applyCategorizationRules(
  transactions: Transaction[],
  rules: CategoryRule[],
  overrides: Record<string, Category>,
  options: CategorizeOptions = {}
): Transaction[] {
  // Lowercase rule keywords once per call instead of once per transaction.
  const lowered = rules.map((r) => ({ keyword: r.keyword.toLowerCase(), category: r.category }));

  const firstPass = transactions.map((tx): Transaction => {
    const override = overrideFor(tx, overrides);
    if (override) return { ...tx, category: override, categorySource: "override" };
    if (tx.categorySource === "manual") return tx;

    const description = tx.description.toLowerCase();
    const matched = lowered.find((r) => description.includes(r.keyword))?.category;
    if (matched) return { ...tx, category: matched, categorySource: "auto" };

    let category: Category;
    if (tx.type === "expense") category = tx.savingsMove || matchesAny(description, options.savingsKeywords) ? "Savings" : "Wants";
    else if (tx.refund) category = "Uncategorized"; // settled below, once purchases are known
    else if (options.repaymentsReduceSpending && tx.source === "statement" && !matchesAny(description, options.salaryKeywords)) category = "Wants";
    else category = "Uncategorized";
    return { ...tx, category, categorySource: "auto" };
  });

  // Refunds: same category as the purchase they pay back, or Wants when it can't be found.
  const purchases = firstPass.filter((t) => t.type === "expense" && !t.excluded);
  return firstPass.map((tx) => {
    if (!tx.refund || tx.categorySource !== "auto" || tx.category !== "Uncategorized") return tx;
    const refundTime = Date.parse(tx.date);
    const original = purchases
      .filter((p) => p.amount === tx.amount && p.date <= tx.date && refundTime - Date.parse(p.date) <= REFUND_LOOKBACK_DAYS * DAY_MS)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return { ...tx, category: original?.category ?? "Wants" };
  });
}
