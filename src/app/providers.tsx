"use client";

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
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

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      {/* Styled like the app's undo bar: flat, ink on light, above the phone's bottom bar. */}
      <Toaster
        position="bottom-center"
        offset={16}
        mobileOffset={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: "flex w-full items-center gap-3 rounded-xl bg-foreground px-4 py-3 text-sm text-background",
            content: "flex-1 min-w-0",
            description: "text-xs text-background/80",
            actionButton: "shrink-0 min-h-11 px-2 -my-2 font-medium underline underline-offset-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background",
          },
        }}
      />
    </QueryClientProvider>
  );
}
