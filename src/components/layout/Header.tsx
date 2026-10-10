"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addMonths, getPeriodLabel } from "@/lib/utils";

interface HeaderProps {
  periodKey: string;
  onPeriodChange: (periodKey: string) => void;
  paydayOfMonth?: number;
  isLoading?: boolean;
  /** When set, replaces the prev/next arrows with a plain label. */
  navLabel?: string;
  /** False hides the pay-period navigator entirely (screens where it does nothing). */
  showPeriod?: boolean;
}

export function Header({ periodKey, onPeriodChange, paydayOfMonth = 1, isLoading = false, navLabel, showPeriod = true }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {isLoading && (
        <div className="absolute top-0 inset-x-0 h-0.5 overflow-hidden" role="status" aria-label="Loading">
          <div className="h-full bg-primary/60 motion-safe:bg-primary motion-safe:animate-loading-sweep" />
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between lg:max-w-none lg:px-6">
        <span className="text-base font-semibold text-foreground lg:hidden font-serif">
          Monera
        </span>

        <div className="flex items-center gap-1 ml-auto lg:ml-0">
          {!showPeriod ? null : navLabel ? (
            <span className="text-sm font-medium text-foreground min-w-35 text-center">{navLabel}</span>
          ) : (
            <>
              <Button variant="ghost" size="icon" onClick={() => onPeriodChange(addMonths(periodKey, -1))} className="size-11 sm:size-9 text-muted-foreground" aria-label="Previous pay period">
                <ChevronLeft size={16} aria-hidden />
              </Button>
              <span className="text-sm font-medium text-foreground min-w-35 text-center" aria-live="polite">
                {getPeriodLabel(periodKey, paydayOfMonth)}
              </span>
              <Button variant="ghost" size="icon" onClick={() => onPeriodChange(addMonths(periodKey, 1))} className="size-11 sm:size-9 text-muted-foreground" aria-label="Next pay period">
                <ChevronRight size={16} aria-hidden />
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
