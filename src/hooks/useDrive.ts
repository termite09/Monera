import { useState, useEffect, useCallback } from "react";
import { DriveStructure, ensureDriveStructure } from "@/lib/google/folders";

export function useDrive(accessToken: string | undefined) {
  const [structure, setStructure] = useState<DriveStructure | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const s = await ensureDriveStructure(accessToken);
      setStructure(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize Drive");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return { structure, isLoading, error, refetch: initialize };
}
