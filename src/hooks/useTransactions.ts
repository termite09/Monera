import { useState, useEffect, useCallback } from "react";
import { Transaction, Category, CategoryRule } from "@/types";
import { DriveStructure, readAppFile, writeAppFile } from "@/lib/google/folders";
import { listFiles, readFile } from "@/lib/google/drive";
import { parseRevolutCSV } from "@/lib/parser/revolut";
import { applyCategorizationRules } from "@/lib/categorizer";
import { mergeTransactions } from "@/lib/dedup";
import { DEFAULT_CATEGORY_RULES } from "@/config/categories";

export function useTransactions(
  accessToken: string | undefined,
  structure: DriveStructure | null
) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(!!accessToken);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    if (!accessToken || !structure) return;
    setIsLoading(true);
    setError(null);

    try {
      // Load app data files
      const [manualTxs, overrides, rules] = await Promise.all([
        readAppFile<Transaction[]>(accessToken, structure.fileIds.manualTransactions),
        readAppFile<Record<string, Category>>(accessToken, structure.fileIds.categoryOverrides),
        readAppFile<CategoryRule[]>(accessToken, structure.fileIds.categoryRules),
      ]);

      // Load and parse all Revolut CSVs
      const csvFiles = await listFiles(
        accessToken,
        `'${structure.revolutExportsId}' in parents and mimeType='text/csv' and trashed=false`
      );

      const csvContents = await Promise.all(
        csvFiles.map((f) => readFile(accessToken, f.id))
      );

      const revolutTxs = csvContents.flatMap((content) => {
        const parsed = parseRevolutCSV(content);
        return parsed.transactions;
      });

      const merged = mergeTransactions(revolutTxs, manualTxs);
      const categorized = applyCategorizationRules(
        merged,
        rules.length > 0 ? rules : DEFAULT_CATEGORY_RULES,
        overrides
      );

      setTransactions(categorized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, structure]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const addManualTransaction = useCallback(
    async (tx: Omit<Transaction, "id" | "source" | "categorySource">) => {
      if (!accessToken || !structure) return;

      const { generateId } = await import("@/lib/utils");
      const id = generateId(`manual-${tx.date}-${tx.description}-${tx.amount}`);
      const newTx: Transaction = {
        ...tx,
        id,
        source: "manual",
        categorySource: "manual",
      };

      const existing = await readAppFile<Transaction[]>(
        accessToken,
        structure.fileIds.manualTransactions
      );
      await writeAppFile(accessToken, structure.fileIds.manualTransactions, [
        newTx,
        ...existing,
      ]);

      setTransactions((prev) => [newTx, ...prev]);
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

      setTransactions((prev) =>
        prev.map((tx) =>
          tx.id === txId ? { ...tx, category, categorySource: "override" } : tx
        )
      );
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
  };
}
