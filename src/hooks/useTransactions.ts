import { useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Transaction, Category, CategoryRule, Settings } from "@/types";
import { DriveStructure, readAppFile, writeAppFile } from "@/lib/google/folders";
import { listFiles, readFile } from "@/lib/google/drive";
import { parseCSV } from "@/lib/parser";
import { applyCategorizationRules } from "@/lib/categorizer";
import { filterInternalTransfers } from "@/lib/transfers";
import { mergeTransactions } from "@/lib/dedup";
import { DriveAuthError } from "@/lib/errors";
import { generateId } from "@/lib/utils";

type ParseCache = Record<string, Transaction[]>;

interface TxData {
  rawTxs: Transaction[];
  overrides: Record<string, Category>;
  excludedIds: string[];
}

const MAX_CACHE_ENTRIES = 60;

// Bump when the parser's output changes so stale entries are re-parsed once.
// v2: parser no longer strips self-transfers / savings-vault mirrors (that moved
// to settings-driven filterInternalTransfers), so cached rows must be rebuilt.
const CACHE_VERSION = "v2";

function cacheKey(f: { id: string; size?: string }): string {
  return `${f.id}:${f.size ?? "0"}:${CACHE_VERSION}`;
}

// Reads everything that makes up the transaction list (manual entries, category
// overrides, exclusions, CSV files + the parse cache) and returns the merged raw
// set. Throws on failure so the query surfaces the error (incl. DriveAuthError).
async function loadTxData(accessToken: string, structure: DriveStructure): Promise<TxData> {
  const [manualTxs, ov, ex] = await Promise.all([
    readAppFile<Transaction[]>(accessToken, structure.fileIds.manualTransactions, []),
    readAppFile<Record<string, Category>>(accessToken, structure.fileIds.categoryOverrides, {}),
    readAppFile<string[]>(accessToken, structure.fileIds.excludedTransactions, []),
  ]);

  const csvFiles = await listFiles(
    accessToken,
    `'${structure.revolutExportsId}' in parents and mimeType='text/csv' and trashed=false`
  );

  // Load parse cache — keyed by fileId:size so we skip re-parsing unchanged files.
  let cache: ParseCache = {};
  try {
    cache = await readAppFile<ParseCache>(accessToken, structure.fileIds.parseCache);
  } catch (err) {
    if (err instanceof DriveAuthError) throw err; // don't swallow auth errors
    // Cache file unreadable/corrupt — start fresh, will be rebuilt below.
  }

  const hits: Transaction[] = [];
  const misses: typeof csvFiles = [];
  for (const f of csvFiles) {
    const key = cacheKey(f);
    if (cache[key]) hits.push(...cache[key]);
    else misses.push(f);
  }

  const missResults = await Promise.all(
    misses.map(async (f) => {
      const content = await readFile(accessToken, f.id);
      return { key: cacheKey(f), parsed: parseCSV(content).transactions };
    })
  );

  const importedTxs: Transaction[] = [...hits];
  const cacheUpdates: ParseCache = {};
  for (const { key, parsed } of missResults) {
    importedTxs.push(...parsed);
    cacheUpdates[key] = parsed;
  }

  // Prune dead entries (deleted CSV files) and write when the cache changed.
  const liveKeys = new Set(csvFiles.map(cacheKey));
  const merged = { ...cache, ...cacheUpdates };
  const pruned = Object.entries(merged).filter(([k]) => liveKeys.has(k));
  const prunedCache = Object.fromEntries(
    pruned.length > MAX_CACHE_ENTRIES ? pruned.slice(-MAX_CACHE_ENTRIES) : pruned
  );
  const cacheChanged = missResults.length > 0 || Object.keys(merged).some((k) => !liveKeys.has(k));
  if (cacheChanged) {
    writeAppFile(accessToken, structure.fileIds.parseCache, prunedCache).catch(() => {
      // Non-fatal: worst case we re-parse next time.
    });
  }

  // Prune overrides whose transaction IDs no longer exist in the merged set.
  // This keeps category-overrides.json from accumulating orphaned entries
  // as transactions are deleted or CSVs are re-uploaded.
  const liveIds = new Set(mergeTransactions(importedTxs, manualTxs ?? []).map((t) => t.id));
  const prunedOverrides = Object.fromEntries(
    Object.entries(ov ?? {}).filter(([id]) => liveIds.has(id))
  );
  const overridesPruned = Object.keys(prunedOverrides).length !== Object.keys(ov ?? {}).length;
  if (overridesPruned) {
    writeAppFile(accessToken, structure.fileIds.categoryOverrides, prunedOverrides).catch(() => {});
  }

  return {
    rawTxs: mergeTransactions(importedTxs, manualTxs ?? []),
    overrides: prunedOverrides,
    excludedIds: ex ?? [],
  };
}

export function useTransactions(
  accessToken: string | undefined,
  structure: DriveStructure | null,
  rules: CategoryRule[],
  settings: Settings
) {
  const qc = useQueryClient();
  const appDataId = structure?.appDataId;
  const queryKey = ["transactions", appDataId ?? "none"];

  // Serialises category override writes so rapid mutations never race each other.
  // Each write waits for the previous to settle before reading and writing Drive.
  const categoryWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const enqueueWrite = useCallback((fn: () => Promise<void>): Promise<void> => {
    const queued = categoryWriteQueue.current.then(fn, fn);
    categoryWriteQueue.current = queued.catch(() => {});
    return queued;
  }, []);

  const query = useQuery({
    queryKey,
    queryFn: () => loadTxData(accessToken as string, structure as DriveStructure),
    enabled: !!accessToken && !!structure,
    retry: (count, err) => !(err instanceof DriveAuthError) && count < 1,
  });

  // Memoized on query.data so the empty fallbacks don't produce a fresh []/{}
  // reference each render (which would needlessly re-run the derivations below).
  const rawTxs = useMemo(() => query.data?.rawTxs ?? [], [query.data]);
  const overrides = useMemo(() => query.data?.overrides ?? {}, [query.data]);
  const excludedIds = useMemo(() => query.data?.excludedIds ?? [], [query.data]);

  const needsReauth = query.error instanceof DriveAuthError;
  const error =
    query.error && !needsReauth
      ? query.error instanceof Error
        ? query.error.message
        : "Failed to load transactions"
      : null;

  const excludedSet = useMemo(() => new Set(excludedIds), [excludedIds]);
  const transactions = useMemo(() => {
    // Drop internal money movements (self-transfers, savings-vault mirrors) using
    // the user's configured keywords before categorizing.
    const visible = filterInternalTransfers(rawTxs, {
      selfTransferKeywords: settings?.selfTransferKeywords,
      savingsVaultKeywords: settings?.savingsVaultKeywords,
    });
    return applyCategorizationRules(visible, rules, overrides).map((tx) =>
      excludedSet.has(tx.id) ? { ...tx, excluded: true } : tx
    );
  }, [rawTxs, rules, overrides, excludedSet, settings?.selfTransferKeywords, settings?.savingsVaultKeywords]);

  // Mutations write to Drive, then patch the cached raw data (same write-then-update
  // behavior as before — the change shows after the write succeeds).
  const patch = useCallback(
    (updater: (d: TxData) => TxData) => {
      qc.setQueryData<TxData>(["transactions", appDataId ?? "none"], (old) => (old ? updater(old) : old));
    },
    [qc, appDataId]
  );

  const addManualTransaction = useCallback(
    async (tx: Omit<Transaction, "id" | "source" | "categorySource">) => {
      if (!accessToken || !structure) return;
      const id = generateId(`manual-${tx.date}-${tx.description}-${tx.amount}-${Date.now()}`);
      const newTx: Transaction = { ...tx, id, source: "manual", categorySource: "manual" };
      const existing = await readAppFile<Transaction[]>(accessToken, structure.fileIds.manualTransactions);
      await writeAppFile(accessToken, structure.fileIds.manualTransactions, [newTx, ...existing]);
      patch((d) => ({ ...d, rawTxs: [newTx, ...d.rawTxs] }));
    },
    [accessToken, structure, patch]
  );

  const deleteManualTransaction = useCallback(
    async (txId: string) => {
      if (!accessToken || !structure) return;
      const [existing, overrides, excludedIds] = await Promise.all([
        readAppFile<Transaction[]>(accessToken, structure.fileIds.manualTransactions),
        readAppFile<Record<string, Category>>(accessToken, structure.fileIds.categoryOverrides),
        readAppFile<string[]>(accessToken, structure.fileIds.excludedTransactions),
      ]);
      const { [txId]: _removed, ...cleanedOverrides } = overrides;
      await Promise.all([
        writeAppFile(accessToken, structure.fileIds.manualTransactions, existing.filter((t) => t.id !== txId)),
        writeAppFile(accessToken, structure.fileIds.categoryOverrides, cleanedOverrides),
        writeAppFile(accessToken, structure.fileIds.excludedTransactions, excludedIds.filter((id) => id !== txId)),
      ]);
      patch((d) => {
        const { [txId]: _ov, ...nextOverrides } = d.overrides;
        return {
          ...d,
          rawTxs: d.rawTxs.filter((t) => t.id !== txId),
          overrides: nextOverrides,
          excludedIds: d.excludedIds.filter((id) => id !== txId),
        };
      });
    },
    [accessToken, structure, patch]
  );

  const updateManualTransaction = useCallback(
    async (txId: string, updates: Omit<Transaction, "id" | "source" | "categorySource">) => {
      if (!accessToken || !structure) return;
      const key = ["transactions", appDataId ?? "none"];
      const prev = qc.getQueryData<TxData>(key);
      // Optimistically apply the update and remove any category override for this
      // transaction so the new category is not silently shadowed by the override.
      patch((d) => {
        const { [txId]: _ov, ...nextOverrides } = d.overrides;
        return {
          ...d,
          rawTxs: d.rawTxs.map((t) => (t.id === txId ? { ...t, ...updates } : t)),
          overrides: nextOverrides,
        };
      });
      try {
        const existing = await readAppFile<Transaction[]>(accessToken, structure.fileIds.manualTransactions);
        const updated = existing.map((t) => (t.id === txId ? { ...t, ...updates } : t));
        await writeAppFile(accessToken, structure.fileIds.manualTransactions, updated);
        // If an override existed in the snapshot, also remove it from Drive (non-blocking).
        if (prev?.overrides[txId] !== undefined) {
          const existingOverrides = await readAppFile<Record<string, Category>>(accessToken, structure.fileIds.categoryOverrides);
          const { [txId]: _removed, ...cleanedOverrides } = existingOverrides;
          writeAppFile(accessToken, structure.fileIds.categoryOverrides, cleanedOverrides).catch(() => {});
        }
      } catch (err) {
        if (prev) qc.setQueryData(key, prev);
        throw err;
      }
    },
    [accessToken, structure, patch, qc, appDataId]
  );

  // Category and exclude are rapid, tap-heavy interactions, so update the UI
  // optimistically (instantly) and roll back if the Drive write fails.
  // Writes are serialised via enqueueWrite so rapid taps never clobber each other.
  const updateCategory = useCallback(
    (txId: string, category: Category): Promise<void> => {
      if (!accessToken || !structure) return Promise.resolve();
      const key = ["transactions", appDataId ?? "none"];
      const prev = qc.getQueryData<TxData>(key);
      patch((d) => ({ ...d, overrides: { ...d.overrides, [txId]: category } }));
      return enqueueWrite(async () => {
        try {
          const existing = await readAppFile<Record<string, Category>>(accessToken, structure.fileIds.categoryOverrides);
          const updated = { ...existing, [txId]: category };
          await writeAppFile(accessToken, structure.fileIds.categoryOverrides, updated);
          patch((d) => ({ ...d, overrides: updated })); // reconcile with the merged Drive value
        } catch (err) {
          if (prev) qc.setQueryData(key, prev);
          throw err;
        }
      });
    },
    [accessToken, structure, patch, qc, appDataId, enqueueWrite]
  );

  const bulkUpdateCategory = useCallback(
    (updates: { txId: string; category: Category }[]): Promise<void> => {
      if (!accessToken || !structure || updates.length === 0) return Promise.resolve();
      const patchEntries = Object.fromEntries(updates.map(({ txId, category }) => [txId, category]));
      const key = ["transactions", appDataId ?? "none"];
      const prev = qc.getQueryData<TxData>(key);
      patch((d) => ({ ...d, overrides: { ...d.overrides, ...patchEntries } }));
      return enqueueWrite(async () => {
        try {
          const existing = await readAppFile<Record<string, Category>>(accessToken, structure.fileIds.categoryOverrides);
          const updated = { ...existing, ...patchEntries };
          await writeAppFile(accessToken, structure.fileIds.categoryOverrides, updated);
          patch((d) => ({ ...d, overrides: updated }));
        } catch (err) {
          if (prev) qc.setQueryData(key, prev);
          throw err;
        }
      });
    },
    [accessToken, structure, patch, qc, appDataId, enqueueWrite]
  );

  // Atomic batch exclude/include — one Drive read-write, no race between IDs.
  const bulkExclude = useCallback(
    async (ids: string[], shouldExclude: boolean) => {
      if (!accessToken || !structure || ids.length === 0) return;
      const key = ["transactions", appDataId ?? "none"];
      const prev = qc.getQueryData<TxData>(key);
      const idSet = new Set(ids);
      patch((d) => {
        const cleaned = d.excludedIds.filter((id) => !idSet.has(id));
        return { ...d, excludedIds: shouldExclude ? [...cleaned, ...ids] : cleaned };
      });
      try {
        const existing = await readAppFile<string[]>(accessToken, structure.fileIds.excludedTransactions);
        const cleaned = existing.filter((id) => !idSet.has(id));
        const next = shouldExclude ? [...cleaned, ...ids] : cleaned;
        await writeAppFile(accessToken, structure.fileIds.excludedTransactions, next);
        patch((d) => ({ ...d, excludedIds: next }));
      } catch (err) {
        if (prev) qc.setQueryData(key, prev);
        throw err;
      }
    },
    [accessToken, structure, patch, qc, appDataId]
  );

  // Reset a single transaction to its original imported state:
  // removes the category override AND re-includes it if excluded.
  const resetToDefault = useCallback(
    async (txId: string) => {
      if (!accessToken || !structure) return;
      const key = ["transactions", appDataId ?? "none"];
      const prev = qc.getQueryData<TxData>(key);
      patch((d) => {
        const { [txId]: _, ...overrides } = d.overrides;
        return { ...d, overrides, excludedIds: d.excludedIds.filter((id) => id !== txId) };
      });
      try {
        const [existingOverrides, existingExcluded] = await Promise.all([
          readAppFile<Record<string, Category>>(accessToken, structure.fileIds.categoryOverrides),
          readAppFile<string[]>(accessToken, structure.fileIds.excludedTransactions),
        ]);
        const { [txId]: _, ...updatedOverrides } = existingOverrides;
        const updatedExcluded = existingExcluded.filter((id) => id !== txId);
        await Promise.all([
          writeAppFile(accessToken, structure.fileIds.categoryOverrides, updatedOverrides),
          writeAppFile(accessToken, structure.fileIds.excludedTransactions, updatedExcluded),
        ]);
        patch((d) => ({ ...d, overrides: updatedOverrides, excludedIds: updatedExcluded }));
      } catch (err) {
        if (prev) qc.setQueryData(key, prev);
        throw err;
      }
    },
    [accessToken, structure, patch, qc, appDataId]
  );

  // Batch version of resetToDefault — one read pair, one write pair for all IDs.
  const bulkResetToDefault = useCallback(
    async (ids: string[]) => {
      if (!accessToken || !structure || ids.length === 0) return;
      const key = ["transactions", appDataId ?? "none"];
      const prev = qc.getQueryData<TxData>(key);
      const idSet = new Set(ids);
      patch((d) => ({
        ...d,
        overrides: Object.fromEntries(Object.entries(d.overrides).filter(([id]) => !idSet.has(id))),
        excludedIds: d.excludedIds.filter((id) => !idSet.has(id)),
      }));
      try {
        const [existingOverrides, existingExcluded] = await Promise.all([
          readAppFile<Record<string, Category>>(accessToken, structure.fileIds.categoryOverrides),
          readAppFile<string[]>(accessToken, structure.fileIds.excludedTransactions),
        ]);
        const updatedOverrides = Object.fromEntries(Object.entries(existingOverrides).filter(([id]) => !idSet.has(id)));
        const updatedExcluded = existingExcluded.filter((id) => !idSet.has(id));
        await Promise.all([
          writeAppFile(accessToken, structure.fileIds.categoryOverrides, updatedOverrides),
          writeAppFile(accessToken, structure.fileIds.excludedTransactions, updatedExcluded),
        ]);
        patch((d) => ({ ...d, overrides: updatedOverrides, excludedIds: updatedExcluded }));
      } catch (err) {
        if (prev) qc.setQueryData(key, prev);
        throw err;
      }
    },
    [accessToken, structure, patch, qc, appDataId]
  );

  const toggleExclude = useCallback(
    async (txId: string) => {
      if (!accessToken || !structure) return;
      const key = ["transactions", appDataId ?? "none"];
      const prev = qc.getQueryData<TxData>(key);
      // Target a definite state (not an independent toggle) so the optimistic
      // update and the Drive write always agree.
      const willExclude = !(prev?.excludedIds ?? []).includes(txId);
      const apply = (ids: string[]) =>
        willExclude ? Array.from(new Set([...ids, txId])) : ids.filter((i) => i !== txId);
      patch((d) => ({ ...d, excludedIds: apply(d.excludedIds) }));
      try {
        const existing = await readAppFile<string[]>(accessToken, structure.fileIds.excludedTransactions);
        const next = apply(existing);
        await writeAppFile(accessToken, structure.fileIds.excludedTransactions, next);
        patch((d) => ({ ...d, excludedIds: next }));
      } catch (err) {
        if (prev) qc.setQueryData(key, prev);
        throw err;
      }
    },
    [accessToken, structure, patch, qc, appDataId]
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
    resetToDefault,
    bulkResetToDefault,
    toggleExclude,
  };
}
