"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

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
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Refetch the NextAuth session every 4 minutes (and on focus) so the access
  // token stays fresh — the server refreshes it before it expires.
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider session={session} refetchInterval={4 * 60} refetchOnWindowFocus>
        <TooltipProvider delayDuration={300}>
          {children}
        </TooltipProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
