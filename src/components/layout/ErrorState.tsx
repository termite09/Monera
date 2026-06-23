import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

/**
 * Inline error banner shown when app data fails to load. Rendered on the failure
 * path only, so it never affects the happy path. Shared across every authenticated
 * page so error handling looks and behaves identically everywhere.
 */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
      <AlertCircle size={16} className="shrink-0 text-destructive" />
      <p className="flex-1 text-sm text-destructive">{message}</p>
      <button onClick={onRetry} className="flex items-center gap-1 text-xs text-destructive underline-offset-2 hover:underline">
        <RefreshCw size={12} /> Retry
      </button>
    </div>
  );
}
