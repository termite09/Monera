import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureDriveStructure, type DriveStructure } from "@/lib/google/folders";
import { DriveAuthError } from "@/lib/errors";

const STORAGE_PREFIX = "monera-drive:";

/** The folder and file ids found on this device last time — only ids, no data. */
function savedStructure(userKey: string | undefined): DriveStructure | undefined {
  if (!userKey) return undefined;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userKey);
    return raw ? (JSON.parse(raw) as DriveStructure) : undefined;
  } catch {
    return undefined; // storage blocked or unreadable — look the ids up instead
  }
}

function saveStructure(userKey: string, structure: DriveStructure): void {
  try { localStorage.setItem(STORAGE_PREFIX + userKey, JSON.stringify(structure)); } catch { /* storage blocked */ }
}

/**
 * Resolves the user's Drive folder/file structure via TanStack Query, so it's
 * cached in memory for the session instead of re-fetched on every navigation.
 * Keyed by the user so switching Google accounts never serves the wrong folder IDs.
 *
 * Finding the folders takes three Drive requests in a row, so the ids are also
 * kept on this device: a return visit starts loading data with them straight
 * away while they're checked in the background. If they've changed (the folder
 * was deleted or trashed), the checked ids replace them and the data reloads.
 */
export function useDrive(accessToken: string | undefined, userKey: string | undefined) {
  const qc = useQueryClient();
  const queryKey = useMemo(() => ["driveStructure", userKey ?? "anon"], [userKey]);

  // Seeded after mount, not as initialData: the server can't see this device's
  // storage, so reading it during the first render would mismatch hydration.
  // Dated 0 so the saved ids count as stale and are always checked once.
  useEffect(() => {
    if (qc.getQueryData(queryKey)) return;
    const saved = savedStructure(userKey);
    if (saved) qc.setQueryData(queryKey, saved, { updatedAt: 0 });
  }, [qc, queryKey, userKey]);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const structure = await ensureDriveStructure(accessToken as string);
      saveStructure(userKey as string, structure);
      return structure;
    },
    enabled: !!accessToken && !!userKey,
    // ensureDriveStructure is idempotent and the structure rarely changes.
    staleTime: 30 * 60 * 1000,
    retry: (count, err) => !(err instanceof DriveAuthError) && count < 1,
  });

  const needsReauth = query.error instanceof DriveAuthError;
  const error =
    query.error && !needsReauth
      ? query.error instanceof Error ? query.error.message : "Failed to initialize Drive"
      : null;

  return {
    structure: query.data ?? null,
    isLoading: query.isPending,
    error,
    needsReauth,
    refetch: query.refetch,
  };
}
