"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { MONTH_NAMES } from "@/config/constants";

interface HeaderProps {
  month: string;
  onMonthChange: (month: string) => void;
}

export function Header({ month, onMonthChange }: HeaderProps) {
  const [year, monthNum] = month.split("-").map(Number);
  const monthLabel = `${MONTH_NAMES[monthNum - 1]} ${year}`;

  const prevMonth = () => {
    const date = new Date(year, monthNum - 2, 1);
    onMonthChange(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  };

  const nextMonth = () => {
    const date = new Date(year, monthNum, 1);
    onMonthChange(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <header className="sticky top-0 z-20 bg-[#FAFAFA] dark:bg-[#0F0F0F] border-b border-gray-200 dark:border-[#2D2D2D] px-4 h-14 flex items-center justify-between">
      <h1 className="text-base font-semibold text-gray-900 dark:text-white md:hidden">
        Monera
      </h1>

      <div className="flex items-center gap-1 ml-auto md:ml-0">
        <button
          onClick={prevMonth}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[130px] text-center">
          {monthLabel}
        </span>
        <button
          onClick={nextMonth}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </header>
  );
}
