"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { getMonthLabel } from "@/lib/utils";

interface HeaderProps {
  month: string;
  onMonthChange: (month: string) => void;
  paydayOfMonth?: number;
  isLoading?: boolean;
  /** When set, replaces the prev/next month arrows with a plain label. */
  navLabel?: string;
}

export function Header({ month, onMonthChange, paydayOfMonth = 1, isLoading = false, navLabel }: HeaderProps) {
  const [year, monthNum] = month.split("-").map(Number);
  const monthLabel = getMonthLabel(month, paydayOfMonth);
  const todayLabel = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  const prevMonth = () => {
    const d = new Date(year, monthNum - 2, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const nextMonth = () => {
    const d = new Date(year, monthNum, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <header
      className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* Top loading bar */}
      <AnimatePresence>
        {isLoading && (
          <div className="absolute top-0 inset-x-0 h-0.5 overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.2, ease: "easeInOut", repeat: Infinity }}
            />
          </div>
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="text-base font-semibold text-foreground md:hidden font-serif">
          Monera
        </span>

        <div className="flex flex-col items-center gap-0.5 ml-auto md:ml-0">
          {navLabel ? (
            <span className="text-sm font-medium text-foreground min-w-35 text-center">{navLabel}</span>
          ) : (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={prevMonth} className="size-9 text-muted-foreground" aria-label="Previous month">
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm font-medium text-foreground min-w-35 text-center">
                {monthLabel}
              </span>
              <Button variant="ghost" size="icon" onClick={nextMonth} className="size-9 text-muted-foreground" aria-label="Next month">
                <ChevronRight size={16} />
              </Button>
            </div>
          )}
          <span className="text-[11px] text-muted-foreground tabular-nums leading-none">{todayLabel}</span>
        </div>
      </div>
    </header>
  );
}
