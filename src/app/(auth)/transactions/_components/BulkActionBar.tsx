import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Props {
  selectedCount: number;
  selectedTotal: number;
  isBulkLoading: boolean;
  hasIncluded: boolean;
  hasExcluded: boolean;
  hasDefaultable: boolean;
  hasExpensesSelected: boolean;
  onExclude: () => void;
  onInclude: () => void;
  onCategory: () => void;
  onDefault: () => void;
  onClear: () => void;
}

export function BulkActionBar({
  selectedCount, selectedTotal,
  isBulkLoading,
  hasIncluded, hasExcluded, hasDefaultable, hasExpensesSelected,
  onExclude, onInclude, onCategory, onDefault, onClear,
}: Props) {
  return (
    <div className="fixed bottom-20 md:bottom-4 left-0 right-0 md:left-56 z-40 px-4" role="region" aria-label="Selected transactions">
      <div className="max-w-2xl mx-auto bg-card border border-border rounded-xl px-4 pt-3 pb-3 flex flex-col gap-2.5 md:max-w-none">
        {/* Row 1: count + total + clear */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-foreground" aria-live="polite">
              {selectedCount} selected
            </span>
            <span className="text-xs text-muted-foreground tabular-nums font-mono">
              {formatCurrency(selectedTotal)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="text-sm text-muted-foreground hover:text-foreground px-2 py-1 -my-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear
          </button>
        </div>
        {/* Row 2: actions or loading indicator */}
        {isBulkLoading ? (
          <div className="flex items-center gap-2 py-0.5">
            <Loader2 size={14} className="animate-spin text-muted-foreground" aria-hidden />
            <span className="text-xs text-muted-foreground" role="status">Updating…</span>
          </div>
        ) : (
          <div className="flex gap-2">
            {hasIncluded && (
              <Button variant="outline" size="sm" className="flex-1" onClick={onExclude}>
                Leave out
              </Button>
            )}
            {hasExcluded && (
              <Button variant="outline" size="sm" className="flex-1" onClick={onInclude}>
                Count again
              </Button>
            )}
            {hasExpensesSelected && (
              <Button size="sm" className="flex-1" onClick={onCategory}>
                Move to…
              </Button>
            )}
            {hasDefaultable && (
              <Button variant="outline" size="sm" className="flex-1" onClick={onDefault}>
                Reset
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
