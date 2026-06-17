import { useState, useEffect, useCallback, useMemo } from "react";
import { Transaction, Category, CategoryRule } from "@/types";
import { DriveStructure, readAppFile, writeAppFile } from "@/lib/google/folders";
import { listFiles, readFile } from "@/lib/google/drive";
import { parseCSV } from "@/lib/parser";
import { applyCategorizationRules } from "@/lib/categorizer";
import { mergeTransactions } from "@/lib/dedup";

export function useTransactions(
  accessToken: string | undefined,
  structure: DriveStructure | null,
  rules: CategoryRule[]
) {
  // Raw, uncategorized transactions parsed from Drive (CSVs + manual file).
  // Kept separate from categorization so changing rules/overrides/excludes is a
  // cheap in-memory recompute and never re-downloads or re-parses the CSVs.
  const [rawTxs, setRawTxs] = useState<Transaction[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Category>>({});
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(!!accessToken);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    if (!accessToken || !structure) return;
    setIsLoading(true);
    setError(null);

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
      const csvContents = await Promise.all(csvFiles.map((f) => readFile(accessToken, f.id)));
      const importedTxs = csvContents.flatMap((content) => parseCSV(content).transactions);

      setRawTxs(mergeTransactions(importedTxs, manualTxs ?? []));
      setOverrides(ov ?? {});
      setExcludedIds(ex ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, structure]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Categorization is a pure transform over the raw data — recomputed only when
  // the inputs actually change, not on every render or rule reference churn.
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
    refetch: loadTransactions,
    addManualTransaction,
    updateCategory,
    toggleExclude,
  };
}
