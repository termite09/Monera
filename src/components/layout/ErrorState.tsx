"use client";

import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { signIn } from "next-auth/react";

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

type Kind = "offline" | "auth" | "drive" | "other";

/** Turns a raw load error into something a person can act on. */
export function describeLoadError(message: string, online = true): { kind: Kind; title: string; body: string } {
  const m = message.toLowerCase();
  if (!online || /failed to fetch|network|offline|timed? ?out/.test(m)) {
    return {
      kind: "offline",
      title: "Can't reach Google Drive",
      body: "Check your connection.",
    };
  }
  if (/\b40[13]\b|unauthori[sz]ed|invalid credentials|access token|invalid_grant|sign.?in|expired/.test(m)) {
    return {
      kind: "auth",
      title: "Your Google sign-in has expired",
      body: "Your data is safe.",
    };
  }
  if (/drive|quota|rate limit|429|5\d\d/.test(m)) {
    return {
      kind: "drive",
      title: "Google Drive is having trouble",
      body: "Usually temporary. Your data is safe.",
    };
  }
  return {
    kind: "other",
    title: "Couldn't load your latest data",
    body: "Your data is safe.",
  };
}

/**
 * Inline error banner shown when app data fails to load. Says what went wrong in
 * plain words and offers the one action that fixes it.
 */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  const { kind, title, body } = describeLoadError(message, online);
  const Icon = kind === "offline" ? WifiOff : AlertCircle;

  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
      <Icon size={18} className="shrink-0 mt-0.5 text-destructive" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-sm text-foreground/80 mt-0.5 max-w-[60ch]">{body}</p>
      </div>
      {kind === "auth" ? (
        <button
          type="button"
          onClick={() => signIn("google")}
          className="shrink-0 min-h-11 px-3 -my-1 rounded-md text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          Sign in again
        </button>
      ) : (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 flex items-center gap-1.5 min-h-11 px-3 -my-1 rounded-md text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          <RefreshCw size={14} aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}
