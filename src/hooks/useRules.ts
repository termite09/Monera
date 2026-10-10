import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CategoryRule } from "@/types";
import { DriveStructure, readAppFile, writeAppFile } from "@/lib/google/folders";
import { DriveAuthError } from "@/lib/errors";
import { notifySaveFailed } from "@/lib/notify";

// Legacy format: old saves wrote a bare CategoryRule[] and seeded built-in
// defaults; this keyword marked a list the user had customized. Uncustomized
// legacy lists were the old seeded defaults, which are no longer used.
const LEGACY_MARKER = "to eur savings";

type StoredRulesFile = { v: 1; customized: boolean; rules: CategoryRule[] };

const NO_RULES: CategoryRule[] = [];

export function useRules(accessToken: string | undefined, structure: DriveStructure | null) {
  const qc = useQueryClient();
  const fileId = structure?.fileIds.categoryRules;
  const queryKey = useMemo(() => ["rules", fileId ?? "none"], [fileId]);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const raw = await readAppFile<StoredRulesFile | CategoryRule[]>(accessToken as string, fileId as string);
      if (Array.isArray(raw)) return raw.some((r) => r.keyword === LEGACY_MARKER) ? raw : NO_RULES;
      return raw?.v === 1 && raw.customized ? raw.rules : NO_RULES;
    },
    enabled: !!accessToken && !!fileId,
    retry: (count, err) => !(err instanceof DriveAuthError) && count < 1,
  });

  const updateRules = useCallback(
    async (next: CategoryRule[]) => {
      if (!accessToken || !fileId) return;
      const prev = qc.getQueryData(queryKey);
      // Saving before the real rules have loaded would replace them, so refuse instead.
      if (!prev) {
        notifySaveFailed();
        throw new Error("Rules haven't loaded yet");
      }
      qc.setQueryData(queryKey, next);
      try {
        await writeAppFile(accessToken, fileId, { v: 1, customized: true, rules: next } satisfies StoredRulesFile);
      } catch (err) {
        qc.setQueryData(queryKey, prev);
        notifySaveFailed();
        throw err;
      }
    },
    [accessToken, fileId, qc, queryKey]
  );

  // Loaded means read from Drive; a failed read is an error, not "no rules".
  const rulesLoaded = query.data !== undefined;
  return {
    rules: query.data ?? NO_RULES,
    updateRules,
    rulesLoaded,
    rulesFailed: !rulesLoaded && query.isError && !(query.error instanceof DriveAuthError),
    refetchRules: query.refetch,
  };
}
