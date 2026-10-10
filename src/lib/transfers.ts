import { Transaction } from "@/types";

interface TransferKeywords {
  /** Descriptions identifying transfers between the user's own accounts. */
  selfTransferKeywords?: string[];
  /** Descriptions identifying Revolut savings-vault deposits. */
  savingsVaultKeywords?: string[];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** One case-insensitive whole-word pattern for a keyword list, or null when the list is empty. */
function keywordPattern(keywords: string[]): RegExp | null {
  const words = keywords.map((k) => k.trim()).filter(Boolean);
  return words.length ? new RegExp(`\\b(?:${words.map(escapeRegex).join("|")})\\b`, "i") : null;
}

/**
 * Removes internal money movements that would otherwise distort totals. Driven
 * entirely by user settings (no hardcoded names) so it works for any account:
 *
 *  - Self-transfers (your own money between your own accounts) are dropped in
 *    both directions — they are neither income nor spending.
 *  - Savings-vault deposits appear twice in a Revolut export (money leaves the
 *    main account, arrives in the vault). We keep the outgoing expense (so it
 *    counts as Savings) and drop the positive mirror to avoid double counting.
 */
export function filterInternalTransfers(
  transactions: Transaction[],
  { selfTransferKeywords = [], savingsVaultKeywords = [] }: TransferKeywords
): Transaction[] {
  const self = keywordPattern(selfTransferKeywords);
  const vault = keywordPattern(savingsVaultKeywords);
  if (!self && !vault) return transactions;

  return transactions.filter((tx) => {
    if (self?.test(tx.description)) return false;
    if (vault && tx.type === "income" && vault.test(tx.description)) return false;
    return true;
  });
}
