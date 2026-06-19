"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { ReactNode, useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

interface ProvidersProps {
  children: ReactNode;
  session?: Session | null;
}

export function Providers({ children, session }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // treat data as fresh for 5 min before a background refetch
            gcTime: 24 * 60 * 60 * 1000, // keep (and persist) cached data for a day
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Persist the query cache to localStorage so reloads hydrate instantly, then
  // revalidate in the background. Storage is undefined during SSR (a noop
  // persister), so the provider tree is identical on server and client.
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      key: "monera-query-cache",
    })
  );

  // Refetch the NextAuth session every 4 minutes (and on focus) so the access
  // token stays fresh — the server refreshes it before it expires.
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000, buster: "v1" }}
    >
      <SessionProvider session={session} refetchInterval={4 * 60} refetchOnWindowFocus>
        {children}
      </SessionProvider>
    </PersistQueryClientProvider>
  );
}
