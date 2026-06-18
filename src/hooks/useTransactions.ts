import { useCallback, useMemo } from "react";
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
    readAppFile<Transaction[]>(accessToken, structure.fileIds.manualTransactions),
    readAppFile<Record<string, Category>>(accessToken, structure.fileIds.categoryOverrides),
    readAppFile<string[]>(accessToken, structure.fileIds.excludedTransactions),
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
  const prunedCache = Object.fromEntries(Object.entries(merged).filter(([k]) => liveKeys.has(k)));
  const cacheChanged = missResults.length > 0 || Object.keys(merged).some((k) => !liveKeys.has(k));
  if (cacheChanged) {
    writeAppFile(accessToken, structure.fileIds.parseCache, prunedCache).catch(() => {
      // Non-fatal: worst case we re-parse next time.
    });
  }

  return {
    rawTxs: mergeTransactions(importedTxs, manualTxs ?? []),
    overrides: ov ?? {},
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

  const query = useQuery({
    queryKey,
    queryFn: () => loadTxData(accessToken as string, structure as DriveStructure),
    enabled: !!accessToken && !!structure,
    retry: (count, err) => !(err instanceof DriveAuthError) && count < 1,
  });

  const rawTxs = query.data?.rawTxs ?? [];
  const overrides = query.data?.overrides ?? {};
  const excludedIds = query.data?.excludedIds ?? [];

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
      const existing = await readAppFile<Transaction[]>(accessToken, structure.fileIds.manualTransactions);
      const updated = existing.filter((t) => t.id !== txId);
      await writeAppFile(accessToken, structure.fileIds.manualTransactions, updated);
      patch((d) => ({ ...d, rawTxs: d.rawTxs.filter((t) => t.id !== txId) }));
    },
    [accessToken, structure, patch]
  );

  const updateCategory = useCallback(
    async (txId: string, category: Category) => {
      if (!accessToken || !structure) return;
      const existing = await readAppFile<Record<string, Category>>(accessToken, structure.fileIds.categoryOverrides);
      const updated = { ...existing, [txId]: category };
      await writeAppFile(accessToken, structure.fileIds.categoryOverrides, updated);
      patch((d) => ({ ...d, overrides: updated }));
    },
    [accessToken, structure, patch]
  );

  const toggleExclude = useCallback(
    async (txId: string) => {
      if (!accessToken || !structure) return;
      const existing = await readAppFile<string[]>(accessToken, structure.fileIds.excludedTransactions);
      const set = new Set(existing);
      if (set.has(txId)) set.delete(txId);
      else set.add(txId);
      const next = [...set];
      await writeAppFile(accessToken, structure.fileIds.excludedTransactions, next);
      patch((d) => ({ ...d, excludedIds: next }));
    },
    [accessToken, structure, patch]
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
    updateCategory,
    toggleExclude,
  };
}
