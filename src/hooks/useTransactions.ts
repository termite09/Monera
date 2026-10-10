import { useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Transaction, Category, CategoryRule, Settings } from "@/types";
import { DriveStructure, listStatementFiles, readAppFile, writeAppFile } from "@/lib/google/folders";
import { readFile } from "@/lib/google/drive";
import { parseCSV } from "@/lib/parser";
import { applyCategorizationRules } from "@/lib/categorizer";
import { filterInternalTransfers } from "@/lib/transfers";
import { mergeTransactions } from "@/lib/dedup";
import { DriveAuthError } from "@/lib/errors";
import { notifySaveFailed } from "@/lib/notify";
import { currencyCode, generateId } from "@/lib/utils";

type ParseCache = Record<string, Transaction[]>;
type Overrides = Record<string, Category>;
export type NewTransaction = Omit<Transaction, "id" | "source" | "categorySource">;

interface TxData {
  rawTxs: Transaction[];
  overrides: Overrides;
  excludedIds: string[];
}

// Bump when the parser's output changes so stale entries are re-parsed once.
// v2: parser no longer strips self-transfers / savings-vault mirrors.
// v3: Revolut parser keeps PENDING rows.
// v4: source "revolut" → "statement"; amounts like "1,234.56" parse correctly.
const CACHE_VERSION = "v4";

function cacheKey(f: { id: string; size?: string }): string {
  return `${f.id}:${f.size ?? "0"}:${CACHE_VERSION}`;
}

const without = <T,>(record: Record<string, T>, ids: Set<string>) =>
  Object.fromEntries(Object.entries(record).filter(([id]) => !ids.has(id)));

/**
 * Read-modify-write of one JSON file in Drive. No fallback on purpose: if the
 * file is unreadable the write fails rather than replacing it.
 */
function updateFile<T>(token: string, fileId: string, change: (current: T) => T): Promise<void> {
  return readAppFile<T>(token, fileId).then((current) => writeAppFile(token, fileId, change(current)));
}

// Reads everything that makes up the transaction list (manual entries, category
// overrides, exclusions, CSV files + the parse cache) and returns the merged raw
// set. Throws on failure so the query surfaces the error (incl. DriveAuthError).
async function loadTxData(accessToken: string, structure: DriveStructure): Promise<TxData> {
  const { fileIds } = structure;
  const [manualTxs, overrides, excludedIds, csvFiles] = await Promise.all([
    readAppFile<Transaction[]>(accessToken, fileIds.manualTransactions, []),
    readAppFile<Overrides>(accessToken, fileIds.categoryOverrides, {}),
    readAppFile<string[]>(accessToken, fileIds.excludedTransactions, []),
    listStatementFiles(accessToken, structure),
  ]);

  // Parse cache, keyed by fileId:size so unchanged files aren't re-parsed.
  let cache: ParseCache = {};
  try {
    cache = await readAppFile<ParseCache>(accessToken, fileIds.parseCache);
  } catch (err) {
    if (err instanceof DriveAuthError) throw err; // don't swallow auth errors
    // Cache file unreadable/corrupt — start fresh, rebuilt below.
  }

  const liveKeys = csvFiles.map(cacheKey);
  const parsed = await Promise.all(
    csvFiles.map(async (f, i) => cache[liveKeys[i]] ?? parseCSV(await readFile(accessToken, f.id)).transactions)
  );
  const nextCache: ParseCache = Object.fromEntries(liveKeys.map((key, i) => [key, parsed[i]]));
  // Rewrite when a file was parsed fresh or a deleted file's entry was dropped.
  const cacheChanged = liveKeys.some((k) => !cache[k]) || Object.keys(cache).length !== liveKeys.length;
  if (cacheChanged) {
    writeAppFile(accessToken, fileIds.parseCache, nextCache).catch(() => {
      // Non-fatal: worst case we re-parse next time.
    });
  }

  // Older manual entries stored a currency symbol ("€"); everything uses ISO codes now.
  const manual = manualTxs.map((t) => ({ ...t, currency: currencyCode(t.currency) }));
  const rawTxs = mergeTransactions(parsed.flat(), manual);

  // Drop overrides whose transactions no longer exist (deleted entries, removed
  // statements) so category-overrides.json doesn't accumulate orphans.
  const liveIds = new Set(rawTxs.map((t) => t.id));
  const liveOverrides = Object.fromEntries(Object.entries(overrides).filter(([id]) => liveIds.has(id)));
  if (Object.keys(liveOverrides).length !== Object.keys(overrides).length) {
    writeAppFile(accessToken, fileIds.categoryOverrides, liveOverrides).catch(() => {});
  }

  return { rawTxs, overrides: liveOverrides, excludedIds };
}

export function useTransactions(
  accessToken: string | undefined,
  structure: DriveStructure | null,
  rules: CategoryRule[],
  settings: Settings
) {
  const qc = useQueryClient();
  const queryKey = useMemo(() => ["transactions", structure?.appDataId ?? "none"], [structure?.appDataId]);

  const query = useQuery({
    queryKey,
    queryFn: () => loadTxData(accessToken as string, structure as DriveStructure),
    enabled: !!accessToken && !!structure,
    retry: (count, err) => !(err instanceof DriveAuthError) && count < 1,
  });

  const data = query.data;
  const { selfTransferKeywords, savingsVaultKeywords } = settings;
  const transactions = useMemo(() => {
    if (!data) return [];
    const excluded = new Set(data.excludedIds);
    // Drop internal money movements (self-transfers, savings-vault mirrors) using
    // the user's configured keywords before categorizing.
    const visible = filterInternalTransfers(data.rawTxs, { selfTransferKeywords, savingsVaultKeywords });
    return applyCategorizationRules(visible, rules, data.overrides).map((tx) =>
      excluded.has(tx.id) ? { ...tx, excluded: true } : tx
    );
  }, [data, rules, selfTransferKeywords, savingsVaultKeywords]);

  const needsReauth = query.error instanceof DriveAuthError;
  const error =
    query.error && !needsReauth
      ? query.error instanceof Error ? query.error.message : "Failed to load transactions"
      : null;

  // Every Drive write goes through this one queue, so two quick changes to the
  // same file never read-modify-write over each other.
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  /**
   * Shows a change instantly, then saves it to Drive in the queue. If the save
   * fails, the list is re-read from Drive (the source of truth) rather than
   * restoring a snapshot that might also undo other changes made meanwhile.
   */
  const mutate = useCallback(
    (optimistic: (d: TxData) => TxData, save: (token: string, s: DriveStructure) => Promise<void>): Promise<void> => {
      if (!accessToken || !structure) return Promise.resolve();
      qc.setQueryData<TxData>(queryKey, (old) => (old ? optimistic(old) : old));
      const run = writeQueue.current.then(() => save(accessToken, structure));
      writeQueue.current = run.catch(() => {});
      return run.catch((err) => {
        qc.invalidateQueries({ queryKey });
        notifySaveFailed();
        throw err;
      });
    },
    [accessToken, structure, qc, queryKey]
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
        (token, s) => updateFile<Transaction[]>(token, s.fileIds.manualTransactions, (all) => [newTx, ...all])
      );
    },
    [mutate]
  );

  const deleteManualTransaction = useCallback(
    (txId: string) => {
      const ids = new Set([txId]);
      return mutate(
        (d) => ({
          rawTxs: d.rawTxs.filter((t) => t.id !== txId),
          overrides: without(d.overrides, ids),
          excludedIds: d.excludedIds.filter((id) => id !== txId),
        }),
        (token, s) =>
          Promise.all([
            updateFile<Transaction[]>(token, s.fileIds.manualTransactions, (all) => all.filter((t) => t.id !== txId)),
            updateFile<Overrides>(token, s.fileIds.categoryOverrides, (o) => without(o, ids)),
            updateFile<string[]>(token, s.fileIds.excludedTransactions, (all) => all.filter((id) => id !== txId)),
          ]).then(() => {})
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
            updateFile<Transaction[]>(token, s.fileIds.manualTransactions, apply),
            updateFile<Overrides>(token, s.fileIds.categoryOverrides, (o) => without(o, ids)),
          ]).then(() => {})
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
        (token, s) => updateFile<Overrides>(token, s.fileIds.categoryOverrides, (o) => ({ ...o, ...changes }))
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
      const idSet = new Set(ids);
      const apply = (all: string[]) => {
        const rest = all.filter((id) => !idSet.has(id));
        return shouldExclude ? [...rest, ...ids] : rest;
      };
      return mutate(
        (d) => ({ ...d, excludedIds: apply(d.excludedIds) }),
        (token, s) => updateFile<string[]>(token, s.fileIds.excludedTransactions, apply)
      );
    },
    [mutate]
  );

  /** Back to how the statement had it: no category override, counted again. */
  const bulkResetToDefault = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return Promise.resolve();
      const idSet = new Set(ids);
      const include = (all: string[]) => all.filter((id) => !idSet.has(id));
      return mutate(
        (d) => ({ ...d, overrides: without(d.overrides, idSet), excludedIds: include(d.excludedIds) }),
        (token, s) =>
          Promise.all([
            updateFile<Overrides>(token, s.fileIds.categoryOverrides, (o) => without(o, idSet)),
            updateFile<string[]>(token, s.fileIds.excludedTransactions, include),
          ]).then(() => {})
      );
    },
    [mutate]
  );

  return {
    transactions,
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
