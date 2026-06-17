"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  // Refetch the session every 4 minutes (and on window focus) so the access
  // token stays fresh — the server refreshes it before it expires.
  return (
    <SessionProvider refetchInterval={4 * 60} refetchOnWindowFocus>
      {children}
    </SessionProvider>
  );
}
