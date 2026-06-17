import { Transaction } from "@/types";

export function deduplicateTransactions(transactions: Transaction[]): Transaction[] {
  const seen = new Set<string>();
  return transactions.filter((tx) => {
    if (seen.has(tx.id)) return false;
    seen.add(tx.id);
    return true;
  });
}

export function mergeTransactions(
  revolutTxs: Transaction[],
  manualTxs: Transaction[]
): Transaction[] {
  const all = [...revolutTxs, ...manualTxs];
  // ISO date strings sort lexically — no Date object allocation needed.
  return deduplicateTransactions(all).sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
}
