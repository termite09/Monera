import { Transaction } from "@/types";

export interface TransferKeywords {
  /** Descriptions identifying transfers between the user's own accounts. */
  selfTransferKeywords?: string[];
  /** Descriptions identifying Revolut savings-vault deposits. */
  savingsVaultKeywords?: string[];
}

function matchesAny(desc: string, keywords: string[]): boolean {
  return keywords.some((k) => desc.includes(k));
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
  const self = selfTransferKeywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  const vault = savingsVaultKeywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (self.length === 0 && vault.length === 0) return transactions;

  return transactions.filter((tx) => {
    const desc = tx.description.toLowerCase();
    if (self.length && matchesAny(desc, self)) return false;
    if (vault.length && tx.type === "income" && matchesAny(desc, vault)) return false;
    return true;
  });
}
