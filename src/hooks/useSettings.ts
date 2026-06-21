import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings } from "@/types";
import { DriveStructure, readAppFile, writeAppFile } from "@/lib/google/folders";
import { DEFAULT_SETTINGS } from "@/config/constants";
import { DriveAuthError } from "@/lib/errors";
import { migrateSettings } from "@/lib/migrateSettings";

export function useSettings(
  accessToken: string | undefined,
  structure: DriveStructure | null
) {
  const qc = useQueryClient();
  const fileId = structure?.fileIds.settings;
  const queryKey = ["settings", fileId ?? "none"];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const s = await readAppFile<Partial<Settings>>(accessToken as string, fileId as string);
      const { migrated, changed } = migrateSettings(s, DEFAULT_SETTINGS as Settings);
      if (changed) {
        // Persist missing-key backfill and version stamp without blocking the return.
        writeAppFile(accessToken as string, fileId as string, migrated).catch(() => {
          // Best-effort — failures are non-fatal; the user will get defaults in memory.
        });
      }
      return migrated;
    },
    enabled: !!accessToken && !!fileId,
    retry: (count, err) => !(err instanceof DriveAuthError) && count < 1,
  });

  const updateSettings = useCallback(
    async (newSettings: Settings) => {
      if (!accessToken || !fileId) return;
      const prev = qc.getQueryData(queryKey);
      qc.setQueryData(queryKey, newSettings);
      try {
        await writeAppFile(accessToken, fileId, newSettings);
      } catch (err) {
        qc.setQueryData(queryKey, prev);
        throw err;
      }
    },
    [accessToken, fileId, qc, queryKey]
  );

  return {
    settings: query.data ?? DEFAULT_SETTINGS,
    updateSettings,
    // Settled (loaded from Drive, or failed and falling back to defaults).
    settingsLoaded: query.isSuccess || query.isError,
  };
}
