import { cn } from "@/lib/utils";

/** The button at the end of a long list that shows the next page of it. */
export function LoadMore({ remaining, onClick, className }: { remaining: number; onClick: () => void; className?: string }) {
  if (remaining <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("w-full py-3 text-sm text-primary hover:bg-secondary/50 transition-colors", className)}
    >
      Load more ({remaining} remaining)
    </button>
  );
}
