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
  return deduplicateTransactions(all).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
