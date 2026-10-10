"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SetupScreenProps {
  error?: string | null;
  onRetry?: () => void;
  /** Heading and explanation shown with an error. */
  errorTitle?: string;
  errorMessage?: string;
}

export function SetupScreen({
  error,
  onRetry,
  errorTitle = "Setup didn't finish",
  errorMessage = "We couldn't open your Monera folder in Google Drive. This is usually temporary, so please try again.",
}: SetupScreenProps) {
  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center bg-background px-6"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="w-full max-w-sm flex flex-col items-center text-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-400">
        <p className="text-4xl text-foreground font-serif">Monera</p>

        {error ? (
          <>
            <div className="mt-8 flex flex-col items-center gap-3" role="alert">
              <span className="flex items-center justify-center size-12 rounded-full bg-destructive/10 text-destructive">
                <AlertCircle size={24} aria-hidden />
              </span>
              <h1 className="text-base font-medium text-foreground">{errorTitle}</h1>
              <p className="text-sm text-muted-foreground max-w-xs">{errorMessage}</p>
            </div>
            {onRetry && (
              <Button onClick={onRetry} className="mt-6 w-full">
                Try again
              </Button>
            )}
          </>
        ) : (
          <div className="mt-8 flex flex-col items-center gap-3" role="status">
            <Loader2 size={22} className="text-muted-foreground motion-safe:animate-spin" aria-hidden />
            <h1 className="text-base font-medium text-foreground">Getting your Monera folder ready</h1>
            <p className="text-sm text-muted-foreground max-w-xs">
              Everything Monera saves lives in one folder in your own Google Drive. This only takes a moment.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
