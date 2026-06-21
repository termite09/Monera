import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CategoryRule } from "@/types";
import { DriveStructure, readAppFile, writeAppFile } from "@/lib/google/folders";
import { DEFAULT_CATEGORY_RULES } from "@/config/categories";
import { DriveAuthError } from "@/lib/errors";

// Legacy marker: old saves wrote a bare CategoryRule[] and used this keyword
// as a sentinel to detect user-customized rules vs. the seeded defaults.
// New saves use { v: 1, customized: true, rules: [...] } — marker no longer needed.
const LEGACY_MARKER = "to eur savings";

type StoredRulesFile = { v: 1; customized: boolean; rules: CategoryRule[] };

export function useRules(
  accessToken: string | undefined,
  structure: DriveStructure | null
) {
  const qc = useQueryClient();
  const fileId = structure?.fileIds.categoryRules;
  const queryKey = ["rules", fileId ?? "none"];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const raw = await readAppFile<StoredRulesFile | CategoryRule[]>(accessToken as string, fileId as string);
      // New format: { v: 1, customized: true, rules: [...] }
      if (raw && !Array.isArray(raw) && (raw as StoredRulesFile).v === 1) {
        return (raw as StoredRulesFile).customized ? (raw as StoredRulesFile).rules : DEFAULT_CATEGORY_RULES;
      }
      // Legacy format: bare array — use marker sentinel for one-time backward compat.
      if (Array.isArray(raw) && raw.length > 0) {
        const wasCustomized = (raw as CategoryRule[]).some((r) => r.keyword === LEGACY_MARKER);
        return wasCustomized ? (raw as CategoryRule[]) : DEFAULT_CATEGORY_RULES;
      }
      return DEFAULT_CATEGORY_RULES;
    },
    enabled: !!accessToken && !!fileId,
    retry: (count, err) => !(err instanceof DriveAuthError) && count < 1,
  });

  const updateRules = useCallback(
    async (next: CategoryRule[]) => {
      if (!accessToken || !fileId) return;
      const prev = qc.getQueryData(queryKey);
      qc.setQueryData(queryKey, next);
      try {
        await writeAppFile(accessToken, fileId, { v: 1, customized: true, rules: next } satisfies StoredRulesFile);
      } catch (err) {
        qc.setQueryData(queryKey, prev);
        throw err;
      }
    },
    [accessToken, fileId, qc, queryKey]
  );

  return { rules: query.data ?? DEFAULT_CATEGORY_RULES, updateRules };
}
