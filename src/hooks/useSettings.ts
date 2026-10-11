import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings } from "@/types";
import { DriveStructure, readAppFile, updateAppFile } from "@/lib/google/folders";
import { DEFAULT_SETTINGS } from "@/config/constants";
import { DriveAuthError } from "@/lib/errors";
import { notifySaveFailed } from "@/lib/notify";
import { migrateSettings } from "@/lib/migrateSettings";
import { useWriteQueue } from "@/hooks/useWriteQueue";

const upToDate = (stored: Partial<Settings>): Settings => migrateSettings(stored, DEFAULT_SETTINGS).migrated;

/** A change to settings, made to the latest copy so quick changes never undo each other. */
export type SettingsChange = (current: Settings) => Settings;

export function useSettings(accessToken: string | undefined, structure: DriveStructure | null) {
  const qc = useQueryClient();
  const fileId = structure?.fileIds.settings;
  const queryKey = useMemo(() => ["settings", fileId ?? "none"], [fileId]);
  const { afterSaves, save } = useWriteQueue<Settings>(queryKey);

  const query = useQuery({
    queryKey,
    queryFn: () =>
      // Older files are brought up to date in memory; the next save stores that.
      afterSaves(async () => upToDate(await readAppFile<Partial<Settings>>(accessToken as string, fileId as string))),
    enabled: !!accessToken && !!fileId,
    // Small file, so re-read on coming back to the app: picks up another device's changes.
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: (count, err) => !(err instanceof DriveAuthError) && count < 1,
  });

  const updateSettings = useCallback(
    (change: SettingsChange): Promise<void> => {
      if (!accessToken || !fileId) return Promise.resolve();
      // Saving before the real settings have loaded would write the defaults
      // over them (bills, budgets, keywords), so refuse instead.
      if (!qc.getQueryData(queryKey)) {
        notifySaveFailed();
        return Promise.reject(new Error("Settings haven't loaded yet"));
      }
      // Saves run in order, and each applies its change to the copy in Drive
      // right then, so a change made on another device isn't written over.
      return save(change, () => updateAppFile<Settings>(accessToken, fileId, (stored) => change(upToDate(stored))));
    },
    [accessToken, fileId, qc, queryKey, save]
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
