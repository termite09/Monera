import { useState, useEffect, useCallback } from "react";
import { DriveStructure, ensureDriveStructure } from "@/lib/google/folders";
import { DriveAuthError } from "@/lib/errors";

export function useDrive(accessToken: string | undefined) {
  const [structure, setStructure] = useState<DriveStructure | null>(null);
  const [isLoading, setIsLoading] = useState(!!accessToken);
  const [error, setError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);

  const initialize = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    setNeedsReauth(false);
    try {
      const s = await ensureDriveStructure(accessToken);
      setStructure(s);
    } catch (err) {
      if (err instanceof DriveAuthError) {
        setNeedsReauth(true);
      } else {
        setError(err instanceof Error ? err.message : "Failed to initialize Drive");
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return { structure, isLoading, error, needsReauth, refetch: initialize };
}
