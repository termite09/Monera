import { useQuery } from "@tanstack/react-query";
import { ensureDriveStructure } from "@/lib/google/folders";
import { DriveAuthError } from "@/lib/errors";

/**
 * Resolves the user's Drive folder/file structure via TanStack Query, so it's
 * cached + persisted (instant on reload, revalidated in the background) instead
 * of re-fetched on every load. Keyed by the user so switching Google accounts
 * never serves the wrong folder IDs.
 */
export function useDrive(accessToken: string | undefined, userKey: string | undefined) {
  const query = useQuery({
    queryKey: ["driveStructure", userKey ?? "anon"],
    queryFn: () => ensureDriveStructure(accessToken as string),
    enabled: !!accessToken && !!userKey,
    // ensureDriveStructure is idempotent and the structure rarely changes.
    staleTime: 30 * 60 * 1000,
    retry: (count, err) => !(err instanceof DriveAuthError) && count < 1,
  });

  const needsReauth = query.error instanceof DriveAuthError;
  const error =
    query.error && !needsReauth
      ? query.error instanceof Error
        ? query.error.message
        : "Failed to initialize Drive"
      : null;

  return {
    structure: query.data ?? null,
    isLoading: query.isPending,
    error,
    needsReauth,
    refetch: query.refetch,
  };
}
