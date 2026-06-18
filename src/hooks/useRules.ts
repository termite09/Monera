import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CategoryRule } from "@/types";
import { DriveStructure, readAppFile, writeAppFile } from "@/lib/google/folders";
import { DEFAULT_CATEGORY_RULES } from "@/config/categories";
import { DriveAuthError } from "@/lib/errors";

// Rules saved by the user always include this keyword, so we can tell a
// user-customized set apart from a stale auto-seeded copy in Drive.
const MARKER = "to eur savings";

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
      const stored = await readAppFile<CategoryRule[]>(accessToken as string, fileId as string);
      // Use stored rules only if the user actually customized & saved them;
      // otherwise fall back to the latest code defaults.
      const customized = Array.isArray(stored) && stored.length > 0 && stored.some((r) => r.keyword === MARKER);
      return customized ? stored : DEFAULT_CATEGORY_RULES;
    },
    enabled: !!accessToken && !!fileId,
    retry: (count, err) => !(err instanceof DriveAuthError) && count < 1,
  });

  const updateRules = useCallback(
    async (next: CategoryRule[]) => {
      if (!accessToken || !fileId) return;
      await writeAppFile(accessToken, fileId, next);
      qc.setQueryData(["rules", fileId], next);
    },
    [accessToken, fileId, qc]
  );

  return { rules: query.data ?? DEFAULT_CATEGORY_RULES, updateRules };
}
