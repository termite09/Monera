import { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

// CSS entrance (not JS) so the page is already visible in the server HTML, before
// hydration; reduced-motion users get no movement at all.
export function PageShell({ children, className = "" }: PageShellProps) {
  return (
    <main
      className={`
        min-h-dvh max-w-full overflow-x-clip bg-background
        pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-6 lg:ml-56
        motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300
        ${className}
      `}
    >
      {children}
    </main>
  );
}
