import { Transaction } from "@/types";
import { generateId } from "@/lib/utils";

const contentKey = (tx: Transaction) => `${tx.date}|${tx.description}|${tx.amount}|${tx.type}|${tx.currency}`;

/**
 * Drops the copies of a transaction that appears in two overlapping statements
 * (same id, same content), but keeps different transactions whose ids happen to
 * collide. Ids are short hashes, so a collision is rare but would otherwise
 * silently delete a real transaction. Within a colliding group the content that
 * sorts first keeps the original id and the others get a derived one, so the
 * outcome doesn't depend on the order files were read in.
 */
function dedupeById(transactions: Transaction[]): Transaction[] {
  const groups = new Map<string, Map<string, Transaction>>();
  for (const tx of transactions) {
    const byContent = groups.get(tx.id) ?? new Map<string, Transaction>();
    const key = contentKey(tx);
    if (!byContent.has(key)) byContent.set(key, tx);
    groups.set(tx.id, byContent);
  }

  const out: Transaction[] = [];
  for (const [id, byContent] of groups) {
    const keys = [...byContent.keys()].sort();
    keys.forEach((key, i) => {
      const tx = byContent.get(key)!;
      out.push(i === 0 ? tx : { ...tx, id: generateId(`${id}|${key}`) });
    });
  }
  return out;
}

/** Statement and manual transactions as one list, duplicates removed, newest first. */
export function mergeTransactions(statementTxs: Transaction[], manualTxs: Transaction[]): Transaction[] {
  // ISO date strings sort lexically — no Date object allocation needed.
  return dedupeById([...statementTxs, ...manualTxs]).sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
}
