import { useState, useEffect, useCallback } from "react";
import { CategoryRule } from "@/types";
import { DriveStructure, readAppFile, writeAppFile } from "@/lib/google/folders";
import { DEFAULT_CATEGORY_RULES } from "@/config/categories";

// Rules saved by the user always include this keyword, so we can tell a
// user-customized set apart from a stale auto-seeded copy in Drive.
const MARKER = "to eur savings";

export function useRules(
  accessToken: string | undefined,
  structure: DriveStructure | null
) {
  const [rules, setRules] = useState<CategoryRule[]>(DEFAULT_CATEGORY_RULES);

  useEffect(() => {
    if (!accessToken || !structure) return;
    readAppFile<CategoryRule[]>(accessToken, structure.fileIds.categoryRules)
      .then((stored) => {
        // Use the stored rules only if the user has actually customized & saved
        // them; otherwise fall back to the latest code defaults.
        const customized = Array.isArray(stored) && stored.length > 0 && stored.some((r) => r.keyword === MARKER);
        setRules(customized ? stored : DEFAULT_CATEGORY_RULES);
      })
      .catch(() => setRules(DEFAULT_CATEGORY_RULES));
  }, [accessToken, structure]);

  const updateRules = useCallback(
    async (next: CategoryRule[]) => {
      if (!accessToken || !structure) return;
      await writeAppFile(accessToken, structure.fileIds.categoryRules, next);
      setRules(next);
    },
    [accessToken, structure]
  );

  return { rules, updateRules };
}
