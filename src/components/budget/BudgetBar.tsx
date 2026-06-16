"use client";

import { motion } from "framer-motion";
import { formatCurrency, clamp } from "@/lib/utils";

interface BudgetBarProps {
  label: string;
  spent: number;
  allocated: number;
  colorClass: string;
}

export function BudgetBar({ label, spent, allocated, colorClass }: BudgetBarProps) {
  const pct = allocated > 0 ? clamp((spent / allocated) * 100, 0, 100) : 0;
  const over = spent > allocated;
  const close = pct >= 80 && !over;

  const barColor = over
    ? "bg-red-500"
    : close
    ? "bg-amber-500"
    : "bg-emerald-500";

  const labelColor = over
    ? "text-red-600 dark:text-red-400"
    : close
    ? "text-amber-600 dark:text-amber-400"
    : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className={`font-medium ${colorClass}`}>{label}</span>
        <span className={`text-xs font-medium ${labelColor} tabular-nums`}>
          {formatCurrency(spent)} / {formatCurrency(allocated)}
        </span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>{pct.toFixed(0)}% used</span>
        {over ? (
          <span className="text-red-500">+{formatCurrency(spent - allocated)} over</span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(allocated - spent)} left</span>
        )}
      </div>
    </div>
  );
}
