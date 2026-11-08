import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Transaction, Category, CategoryRule, Settings, StatementCoverage } from "@/types";
import { DriveStructure, listStatementFiles, readAppFile, updateAppFile } from "@/lib/google/folders";
import { readFile, writeFile } from "@/lib/google/drive";
import { parseCSV } from "@/lib/parser";
import { applyCategorizationRules } from "@/lib/categorizer";
import { filterInternalTransfers } from "@/lib/transfers";
import { isLeftOut, mergeTransactions } from "@/lib/dedup";
import { DriveAuthError } from "@/lib/errors";
import { currencyCode } from "@/lib/format";
import { generateId } from "@/lib/utils";
import { useWriteQueue } from "@/hooks/useWriteQueue";

/** A statement file, parsed: its transactions, the payments it shows as cancelled, and what it covers. */
type ParsedFile = { transactions: Transaction[]; cancelled: string[]; coverage: StatementCoverage[] };
type ParseCache = Record<string, ParsedFile>;
type Overrides = Record<string, Category>;
export type NewTransaction = Omit<Transaction, "id" | "source" | "categorySource">;

interface TxData {
  rawTxs: Transaction[];
  coverage: StatementCoverage[];
  overrides: Overrides;
  excludedIds: string[];
}

// Bump when the parser's output changes so stale entries are re-parsed once.
// v2: parser no longer strips self-transfers / savings-vault mirrors.
// v3: Revolut parser keeps PENDING rows.
// v4: source "revolut" → "statement"; amounts like "1,234.56" parse correctly.
// v6: fees counted, refund rows kept, renamed/re-amounted duplicates matched,
//     reverted payments cancel pending copies, vault moves paired, and each
//     entry stores { transactions, cancelled, coverage } instead of a bare list.
//     (v5 was used briefly with a different entry shape, so it's skipped.)
const CACHE_VERSION = "v6";

/**
 * A cached entry, if it has the shape this version expects. The cache only
 * saves time, so anything else is read again from the statement rather than
 * trusted: a bad cache entry must never stop the transactions loading.
 */
export function fromCache(entry: unknown): ParsedFile | null {
  if (!entry || typeof entry !== "object" || !Array.isArray((entry as ParsedFile).transactions)) return null;
  const { transactions, cancelled, coverage } = entry as Partial<ParsedFile>;
  return {
    transactions: transactions as Transaction[],
    cancelled: Array.isArray(cancelled) ? cancelled : [],
    coverage: Array.isArray(coverage) ? coverage : [],
  };
}

function cacheKey(f: { id: string; size?: string }): string {
  return `${f.id}:${f.size ?? "0"}:${CACHE_VERSION}`;
}

const NO_COVERAGE: StatementCoverage[] = [];

const without = <T,>(record: Record<string, T>, ids: Set<string>) =>
  Object.fromEntries(Object.entries(record).filter(([id]) => !ids.has(id)));

// Reads everything that makes up the transaction list (manual entries, category
// overrides, exclusions, CSV files + the parse cache) and returns the merged raw
// set. Throws on failure so the query surfaces the error (incl. DriveAuthError).
async function loadTxData(accessToken: string, structure: DriveStructure): Promise<TxData> {
  const { fileIds } = structure;
  const [manualTxs, overrides, excludedIds, csvFiles, cache] = await Promise.all([
    readAppFile<Transaction[]>(accessToken, fileIds.manualTransactions, []),
    readAppFile<Overrides>(accessToken, fileIds.categoryOverrides, {}),
    readAppFile<string[]>(accessToken, fileIds.excludedTransactions, []),
    listStatementFiles(accessToken, structure),
    // Parse cache, keyed by fileId:size so unchanged files aren't re-parsed.
    readAppFile<ParseCache>(accessToken, fileIds.parseCache).catch((err): ParseCache => {
      if (err instanceof DriveAuthError) throw err; // don't swallow auth errors
      return {}; // Cache file unreadable/corrupt — start fresh, rebuilt below.
    }),
  ]);

  const liveKeys = csvFiles.map(cacheKey);
  const parsed = await Promise.all(
    csvFiles.map(async (f, i): Promise<ParsedFile> => {
      const cached = fromCache(cache[liveKeys[i]]);
      if (cached) return cached;
      const { transactions, cancelled = [], coverage = [] } = parseCSV(await readFile(accessToken, f.id));
      return { transactions, cancelled, coverage };
    })
  );
  const nextCache: ParseCache = Object.fromEntries(liveKeys.map((key, i) => [key, parsed[i]]));
  // Rewrite when a file was parsed fresh or a deleted file's entry was dropped.
  const cacheChanged = liveKeys.some((k) => !fromCache(cache[k])) || Object.keys(cache).length !== liveKeys.length;
  if (cacheChanged) {
    // Unindented: this is the biggest app file and only Monera reads it.
    writeFile(accessToken, fileIds.parseCache, JSON.stringify(nextCache)).catch(() => {
      // Non-fatal: worst case we re-parse next time.
    });
  }

  // Older manual entries stored a currency symbol ("€"); everything uses ISO codes now.
  const manual = manualTxs.map((t) => ({ ...t, currency: currencyCode(t.currency) }));
  const rawTxs = mergeTransactions(parsed.flatMap((p) => p.transactions), manual, parsed.flatMap((p) => p.cancelled));

  // Overrides for transactions that aren't loaded (a removed statement) are kept
  // on purpose: adding that statement again brings its categories back.
  return { rawTxs, coverage: parsed.flatMap((p) => p.coverage), overrides, excludedIds };
}

export function useTransactions(
  accessToken: string | undefined,
  structure: DriveStructure | null,
  rules: CategoryRule[],
  settings: Settings
) {
  const queryKey = useMemo(() => ["transactions", structure?.appDataId ?? "none"], [structure?.appDataId]);
  // Every Drive write goes through this one queue, so two quick changes to the
  // same file never read-modify-write over each other.
  const { afterSaves, save } = useWriteQueue<TxData>(queryKey);

  const query = useQuery({
    queryKey,
    queryFn: () => afterSaves(() => loadTxData(accessToken as string, structure as DriveStructure)),
    enabled: !!accessToken && !!structure,
    retry: (count, err) => !(err instanceof DriveAuthError) && count < 1,
  });

  const data = query.data;
  const { selfTransferKeywords, savingsVaultKeywords, salaryKeywords, repaymentsReduceSpending } = settings;
  /**
   * Applies rules and the user's own changes (category moves, leave-outs). Also
   * used for bills, which are made from Settings rather than loaded, so a bill
   * can be moved or left out for one period like any other transaction.
   */
  const applyUserChanges = useCallback(
    (txs: Transaction[]): Transaction[] => {
      if (!data) return txs;
      const excluded = new Set(data.excludedIds);
      return applyCategorizationRules(txs, rules, data.overrides, {
        savingsKeywords: savingsVaultKeywords,
        repaymentsReduceSpending,
        salaryKeywords,
      }).map((tx) => (isLeftOut(tx, excluded) ? { ...tx, excluded: true } : tx));
    },
    [data, rules, savingsVaultKeywords, repaymentsReduceSpending, salaryKeywords]
  );

  /** The ids plus any each transaction had in other exports, so undoing a change clears it everywhere. */
  const withAliases = useCallback(
    (ids: string[]): Set<string> => {
      const all = new Set(ids);
      for (const tx of data?.rawTxs ?? []) if (all.has(tx.id)) tx.aliases?.forEach((id) => all.add(id));
      return all;
    },
    [data]
  );

  // Drop internal money movements (self-transfers, savings-vault mirrors) using
  // the user's configured keywords before categorizing.
  const transactions = useMemo(
    () => (data ? applyUserChanges(filterInternalTransfers(data.rawTxs, { selfTransferKeywords, savingsVaultKeywords })) : []),
    [data, applyUserChanges, selfTransferKeywords, savingsVaultKeywords]
  );

  const needsReauth = query.error instanceof DriveAuthError;
  const error =
    query.error && !needsReauth
      ? query.error instanceof Error ? query.error.message : "Failed to load transactions"
      : null;

  /**
   * Shows a change instantly, then saves it to Drive in the queue. The screen
   * keeps the optimistic copy: a save writes single files, not the whole set.
   */
  const mutate = useCallback(
    (optimistic: (d: TxData) => TxData, write: (token: string, s: DriveStructure) => Promise<unknown>): Promise<void> => {
      if (!accessToken || !structure) return Promise.resolve();
      return save(optimistic, () => write(accessToken, structure).then(() => undefined));
    },
    [accessToken, structure, save]
  );

  const addManualTransaction = useCallback(
    (tx: NewTransaction) => {
      const newTx: Transaction = {
        ...tx,
        id: generateId(`manual-${tx.date}-${tx.description}-${tx.amount}-${Date.now()}`),
        source: "manual",
        categorySource: "manual",
      };
      return mutate(
        (d) => ({ ...d, rawTxs: [newTx, ...d.rawTxs] }),
        (token, s) => updateAppFile<Transaction[]>(token, s.fileIds.manualTransactions, (all) => [newTx, ...all])
      );
    },
    [mutate]
  );

  const deleteManualTransaction = useCallback(
    (txId: string) => {
      const ids = new Set([txId]);
      return mutate(
        (d) => ({
          ...d,
          rawTxs: d.rawTxs.filter((t) => t.id !== txId),
          overrides: without(d.overrides, ids),
          excludedIds: d.excludedIds.filter((id) => id !== txId),
        }),
        (token, s) =>
          Promise.all([
            updateAppFile<Transaction[]>(token, s.fileIds.manualTransactions, (all) => all.filter((t) => t.id !== txId)),
            updateAppFile<Overrides>(token, s.fileIds.categoryOverrides, (o) => without(o, ids)),
            updateAppFile<string[]>(token, s.fileIds.excludedTransactions, (all) => all.filter((id) => id !== txId)),
          ])
      );
    },
    [mutate]
  );

  // Editing also clears any category override, so the new category isn't
  // silently shadowed by an old one.
  const updateManualTransaction = useCallback(
    (txId: string, updates: NewTransaction) => {
      const ids = new Set([txId]);
      const apply = (all: Transaction[]) => all.map((t) => (t.id === txId ? { ...t, ...updates } : t));
      return mutate(
        (d) => ({ ...d, rawTxs: apply(d.rawTxs), overrides: without(d.overrides, ids) }),
        (token, s) =>
          Promise.all([
            updateAppFile<Transaction[]>(token, s.fileIds.manualTransactions, apply),
            updateAppFile<Overrides>(token, s.fileIds.categoryOverrides, (o) => without(o, ids)),
          ])
      );
    },
    [mutate]
  );

  const bulkUpdateCategory = useCallback(
    (updates: { txId: string; category: Category }[]) => {
      if (updates.length === 0) return Promise.resolve();
      const changes = Object.fromEntries(updates.map(({ txId, category }) => [txId, category]));
      return mutate(
        (d) => ({ ...d, overrides: { ...d.overrides, ...changes } }),
        (token, s) => updateAppFile<Overrides>(token, s.fileIds.categoryOverrides, (o) => ({ ...o, ...changes }))
      );
    },
    [mutate]
  );

  const updateCategory = useCallback(
    (txId: string, category: Category) => bulkUpdateCategory([{ txId, category }]),
    [bulkUpdateCategory]
  );

  const bulkExclude = useCallback(
    (ids: string[], shouldExclude: boolean) => {
      if (ids.length === 0) return Promise.resolve();
      const idSet = withAliases(ids);
      const apply = (all: string[]) => {
        const rest = all.filter((id) => !idSet.has(id));
        return shouldExclude ? [...rest, ...ids] : rest;
      };
      return mutate(
        (d) => ({ ...d, excludedIds: apply(d.excludedIds) }),
        (token, s) => updateAppFile<string[]>(token, s.fileIds.excludedTransactions, apply)
      );
    },
    [mutate, withAliases]
  );

  /** Back to how the statement had it: no category override, counted again. */
  const bulkResetToDefault = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return Promise.resolve();
      const idSet = withAliases(ids);
      const include = (all: string[]) => all.filter((id) => !idSet.has(id));
      return mutate(
        (d) => ({ ...d, overrides: without(d.overrides, idSet), excludedIds: include(d.excludedIds) }),
        (token, s) =>
          Promise.all([
            updateAppFile<Overrides>(token, s.fileIds.categoryOverrides, (o) => without(o, idSet)),
            updateAppFile<string[]>(token, s.fileIds.excludedTransactions, include),
          ])
      );
    },
    [mutate, withAliases]
  );

  return {
    transactions,
    /** What each statement covers, for spotting missing ones. */
    coverage: data?.coverage ?? NO_COVERAGE,
    applyUserChanges,
    isLoading: query.isPending,
    hasLoaded: query.isSuccess,
    error,
    needsReauth,
    refetch: query.refetch,
    addManualTransaction,
    deleteManualTransaction,
    updateManualTransaction,
    updateCategory,
    bulkUpdateCategory,
    bulkExclude,
    bulkResetToDefault,
  };
}
