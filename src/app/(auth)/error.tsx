"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Route-segment error boundary for the authenticated area. Catches uncaught
 * render errors in any (auth) page so the user sees a recoverable fallback
 * instead of a blank screen. `unstable_retry` (Next.js 16.2) re-fetches and
 * re-renders the segment; `reset` is kept as a fallback for older behavior.
 */
export default function AuthError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <AlertCircle size={32} className="text-destructive" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          We couldn&apos;t load this page. This is usually temporary — try again.
        </p>
      </div>
      <Button onClick={() => (unstable_retry ?? reset)()}>Try again</Button>
    </div>
  );
}
