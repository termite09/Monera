import { useState, useEffect, useCallback } from "react";
import { Settings } from "@/types";
import { DriveStructure, readAppFile, writeAppFile } from "@/lib/google/folders";
import { DEFAULT_SETTINGS } from "@/config/constants";

export function useSettings(
  accessToken: string | undefined,
  structure: DriveStructure | null
) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    if (!accessToken || !structure) return;
    readAppFile<Settings>(accessToken, structure.fileIds.settings)
      .then((s) => setSettings({ ...DEFAULT_SETTINGS, ...s }))
      .catch(() => setSettings(DEFAULT_SETTINGS))
      .finally(() => setSettingsLoaded(true));
  }, [accessToken, structure]);

  const updateSettings = useCallback(
    async (newSettings: Settings) => {
      if (!accessToken || !structure) return;
      await writeAppFile(accessToken, structure.fileIds.settings, newSettings);
      setSettings(newSettings);
    },
    [accessToken, structure]
  );

  return { settings, updateSettings, settingsLoaded };
}
