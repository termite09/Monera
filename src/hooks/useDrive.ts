import { useState, useEffect, useCallback, useRef } from "react";
import { DriveStructure, ensureDriveStructure } from "@/lib/google/folders";
import { DriveAuthError } from "@/lib/errors";

export function useDrive(accessToken: string | undefined) {
  const [structure, setStructure] = useState<DriveStructure | null>(null);
  const [isLoading, setIsLoading] = useState(!!accessToken);
  const [error, setError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  // Dedupe concurrent setup runs (StrictMode double-mount, rapid refetch) so the
  // folder/file creation can't race and create duplicates.
  const inFlight = useRef<Promise<void> | null>(null);

  const initialize = useCallback(async () => {
    if (!accessToken) return;
    if (inFlight.current) return inFlight.current;

    setIsLoading(true);
    setError(null);
    setNeedsReauth(false);

    const run = (async () => {
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
        inFlight.current = null;
      }
    })();

    inFlight.current = run;
    return run;
  }, [accessToken]);

  useEffect(() => {
    // Data-loading effect: synchronizing React state with an async external system.
    initialize();
  }, [initialize]);

  return { structure, isLoading, error, needsReauth, refetch: initialize };
}
