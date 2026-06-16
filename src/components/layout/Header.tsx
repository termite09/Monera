"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMonthLabel } from "@/lib/utils";

interface HeaderProps {
  month: string;
  onMonthChange: (month: string) => void;
  paydayOfMonth?: number;
}

export function Header({ month, onMonthChange, paydayOfMonth = 1 }: HeaderProps) {
  const [year, monthNum] = month.split("-").map(Number);
  const monthLabel = getMonthLabel(month, paydayOfMonth);

  const prevMonth = () => {
    const d = new Date(year, monthNum - 2, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const nextMonth = () => {
    const d = new Date(year, monthNum, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border px-4 h-14 flex items-center justify-between">
      <span className="text-sm font-semibold text-foreground md:hidden" style={{ fontFamily: "'DM Serif Display', serif" }}>
        Monera
      </span>

      <div className="flex items-center gap-1 ml-auto md:ml-0">
        <Button variant="ghost" size="icon" onClick={prevMonth} className="size-9 text-muted-foreground">
          <ChevronLeft size={16} />
        </Button>
        <span className="text-sm font-medium text-foreground min-w-[140px] text-center">
          {monthLabel}
        </span>
        <Button variant="ghost" size="icon" onClick={nextMonth} className="size-9 text-muted-foreground">
          <ChevronRight size={16} />
        </Button>
      </div>
    </header>
  );
}
