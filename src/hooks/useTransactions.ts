import { useState, useEffect, useCallback, useMemo } from "react";
import { Transaction, Category, CategoryRule } from "@/types";
import { DriveStructure, readAppFile, writeAppFile } from "@/lib/google/folders";
import { listFiles, readFile } from "@/lib/google/drive";
import { parseCSV } from "@/lib/parser";
import { applyCategorizationRules } from "@/lib/categorizer";
import { mergeTransactions } from "@/lib/dedup";
import { DriveAuthError } from "@/lib/errors";

type ParseCache = Record<string, Transaction[]>;

export function useTransactions(
  accessToken: string | undefined,
  structure: DriveStructure | null,
  rules: CategoryRule[]
) {
  const [rawTxs, setRawTxs] = useState<Transaction[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Category>>({});
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(!!accessToken);
  const [error, setError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);

  const loadTransactions = useCallback(async () => {
    if (!accessToken || !structure) return;
    setIsLoading(true);
    setError(null);
    setNeedsReauth(false);

    try {
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

      // Split files into cache hits and misses, then fetch all misses in parallel
      // (restores the original Promise.all parallelism while still using the cache).
      const hits: Transaction[] = [];
      const misses: typeof csvFiles = [];
      for (const f of csvFiles) {
        const key = `${f.id}:${f.size ?? "0"}`;
        if (cache[key]) {
          hits.push(...cache[key]);
        } else {
          misses.push(f);
        }
      }

      const missResults = await Promise.all(
        misses.map(async (f) => {
          const content = await readFile(accessToken, f.id);
          return { key: `${f.id}:${f.size ?? "0"}`, parsed: parseCSV(content).transactions };
        })
      );

      const importedTxs: Transaction[] = [...hits];
      const cacheUpdates: ParseCache = {};
      for (const { key, parsed } of missResults) {
        importedTxs.push(...parsed);
        cacheUpdates[key] = parsed;
      }

      if (missResults.length > 0) {
        // Prune dead entries (deleted/replaced CSV files) then write.
        const liveKeys = new Set(csvFiles.map((f) => `${f.id}:${f.size ?? "0"}`));
        const updatedCache = Object.fromEntries(
          Object.entries({ ...cache, ...cacheUpdates }).filter(([k]) => liveKeys.has(k))
        );
        writeAppFile(accessToken, structure.fileIds.parseCache, updatedCache).catch(() => {
          // Non-fatal: worst case we re-parse next time.
        });
      }

      setRawTxs(mergeTransactions(importedTxs, manualTxs ?? []));
      setOverrides(ov ?? {});
      setExcludedIds(ex ?? []);
    } catch (err) {
      if (err instanceof DriveAuthError) {
        setNeedsReauth(true);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load transactions");
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, structure]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const excludedSet = useMemo(() => new Set(excludedIds), [excludedIds]);
  const transactions = useMemo(
    () =>
      applyCategorizationRules(rawTxs, rules, overrides).map((tx) =>
        excludedSet.has(tx.id) ? { ...tx, excluded: true } : tx
      ),
    [rawTxs, rules, overrides, excludedSet]
  );

  const addManualTransaction = useCallback(
    async (tx: Omit<Transaction, "id" | "source" | "categorySource">) => {
      if (!accessToken || !structure) return;

      const { generateId } = await import("@/lib/utils");
      const id = generateId(`manual-${tx.date}-${tx.description}-${tx.amount}`);
      const newTx: Transaction = { ...tx, id, source: "manual", categorySource: "manual" };

      const existing = await readAppFile<Transaction[]>(
        accessToken,
        structure.fileIds.manualTransactions
      );
      await writeAppFile(accessToken, structure.fileIds.manualTransactions, [newTx, ...existing]);

      setRawTxs((prev) => [newTx, ...prev]);
    },
    [accessToken, structure]
  );

  const deleteManualTransaction = useCallback(
    async (txId: string) => {
      if (!accessToken || !structure) return;

      const existing = await readAppFile<Transaction[]>(
        accessToken,
        structure.fileIds.manualTransactions
      );
      const updated = existing.filter((t) => t.id !== txId);
      await writeAppFile(accessToken, structure.fileIds.manualTransactions, updated);

      setRawTxs((prev) => prev.filter((t) => t.id !== txId));
    },
    [accessToken, structure]
  );

  const updateCategory = useCallback(
    async (txId: string, category: Category) => {
      if (!accessToken || !structure) return;

      const existing = await readAppFile<Record<string, Category>>(
        accessToken,
        structure.fileIds.categoryOverrides
      );
      const updated = { ...existing, [txId]: category };
      await writeAppFile(accessToken, structure.fileIds.categoryOverrides, updated);

      setOverrides(updated);
    },
    [accessToken, structure]
  );

  const toggleExclude = useCallback(
    async (txId: string) => {
      if (!accessToken || !structure) return;

      const existing = await readAppFile<string[]>(
        accessToken,
        structure.fileIds.excludedTransactions
      );
      const set = new Set(existing);
      if (set.has(txId)) set.delete(txId);
      else set.add(txId);
      const next = [...set];
      await writeAppFile(accessToken, structure.fileIds.excludedTransactions, next);

      setExcludedIds(next);
    },
    [accessToken, structure]
  );

  return {
    transactions,
    isLoading,
    error,
    needsReauth,
    refetch: loadTransactions,
    addManualTransaction,
    deleteManualTransaction,
    updateCategory,
    toggleExclude,
  };
}
