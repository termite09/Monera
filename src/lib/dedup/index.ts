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

/**
 * One transaction per payment across overlapping exports, even when Revolut
 * renamed the shop between them ("Αλφα μέγα" then "AlphaMega", "Esso" while
 * pending then "Strovolos Avenue") or the amount settled differently. Rows with
 * the same match key are the same payment. The settled row wins over a pending
 * one, then the first seen (the newest upload). The others' ids are kept as
 * aliases so changes saved against them still apply. A payment still pending
 * everywhere it appears is dropped if a later export shows it reverted.
 */
function collapseRenamed(transactions: Transaction[], cancelled: Set<string>): Transaction[] {
  const groups = new Map<string, Transaction[]>();
  const out: (Transaction | string)[] = [];
  for (const tx of transactions) {
    if (!tx.matchKey) { out.push(tx); continue; }
    const group = groups.get(tx.matchKey);
    if (group) group.push(tx);
    else { groups.set(tx.matchKey, [tx]); out.push(tx.matchKey); }
  }
  return out.flatMap((entry) => {
    if (typeof entry !== "string") return [entry];
    const group = groups.get(entry)!;
    const settled = group.find((t) => !t.pending);
    // Never cancels a settled payment, only a copy that was still pending.
    if (!settled && cancelled.has(entry)) return [];
    const winner = settled ?? group[0];
    const aliases = [...new Set(group.map((t) => t.id).filter((id) => id !== winner.id))];
    return [aliases.length ? { ...winner, aliases } : winner];
  });
}

/**
 * Whether the user left a transaction out. A payment merged from several
 * exports counts as left out only if every copy was: leaving out one copy of a
 * double-counted purchase was a way round the duplicate, not a wish to drop it.
 * (Leaving one out now marks every copy.)
 */
export function isLeftOut(tx: Transaction, excludedIds: Set<string>): boolean {
  return [tx.id, ...(tx.aliases ?? [])].every((id) => excludedIds.has(id));
}

/**
 * Statement and manual transactions as one list, duplicates removed, newest
 * first. `statementTxs` should list the newest upload first: when one payment
 * appears under two names, that's the name kept.
 */
export function mergeTransactions(statementTxs: Transaction[], manualTxs: Transaction[], cancelled: Iterable<string> = []): Transaction[] {
  // ISO date strings sort lexically — no Date object allocation needed.
  return dedupeById([...collapseRenamed(statementTxs, new Set(cancelled)), ...manualTxs]).sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
}
