import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings } from "@/types";
import { DriveStructure, readAppFile, writeAppFile } from "@/lib/google/folders";
import { DEFAULT_SETTINGS } from "@/config/constants";
import { DriveAuthError } from "@/lib/errors";
import { notifySaveFailed } from "@/lib/notify";
import { migrateSettings } from "@/lib/migrateSettings";

export function useSettings(accessToken: string | undefined, structure: DriveStructure | null) {
  const qc = useQueryClient();
  const fileId = structure?.fileIds.settings;
  const queryKey = useMemo(() => ["settings", fileId ?? "none"], [fileId]);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const s = await readAppFile<Partial<Settings>>(accessToken as string, fileId as string);
      const { migrated, changed } = migrateSettings(s, DEFAULT_SETTINGS);
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
      // Saving before the real settings have loaded would write the defaults
      // over them (bills, budgets, keywords), so refuse instead.
      if (!prev) {
        notifySaveFailed();
        throw new Error("Settings haven't loaded yet");
      }
      qc.setQueryData(queryKey, newSettings);
      try {
        await writeAppFile(accessToken, fileId, newSettings);
      } catch (err) {
        qc.setQueryData(queryKey, prev);
        notifySaveFailed();
        throw err;
      }
    },
    [accessToken, fileId, qc, queryKey]
  );

  // Loaded means read from Drive. A failed read is an error, never "defaults":
  // treating it as loaded would show an existing user the first-run setup.
  const settingsLoaded = query.data !== undefined;
  return {
    settings: query.data ?? DEFAULT_SETTINGS,
    updateSettings,
    settingsLoaded,
    settingsFailed: !settingsLoaded && query.isError && !(query.error instanceof DriveAuthError),
    refetchSettings: query.refetch,
  };
}
