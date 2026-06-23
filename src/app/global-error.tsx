"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import "./globals.css";

/**
 * Last-resort error boundary for the root layout. Renders when an error escapes
 * every nested boundary, so it must provide its own <html>/<body> and styles.
 * Kept dependency-free and self-contained so it can render even when the rest of
 * the app has failed to load.
 */
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#F8F7F4",
          color: "#1C3557",
        }}
      >
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>Something went wrong</h2>
        <p style={{ maxWidth: "24rem", fontSize: "0.875rem", color: "#64748b", margin: 0 }}>
          Monera hit an unexpected error. This is usually temporary — try again.
        </p>
        <button
          onClick={() => (unstable_retry ?? reset)()}
          style={{
            cursor: "pointer",
            border: "none",
            borderRadius: "0.5rem",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            background: "#1C3557",
            color: "#fff",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
