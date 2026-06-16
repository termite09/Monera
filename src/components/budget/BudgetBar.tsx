"use client";

import { Progress } from "@/components/ui/progress";
import { formatCurrency, clamp } from "@/lib/utils";
import { cn } from "@/lib/utils";

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

  const statusColor = over
    ? "text-destructive"
    : close
    ? "text-amber-600 dark:text-amber-400"
    : "text-emerald-600 dark:text-emerald-400";

  const indicatorColor = over
    ? "bg-destructive"
    : close
    ? "bg-amber-500"
    : "bg-emerald-500";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className={cn("text-sm font-medium", colorClass)}>{label}</span>
        <span className={cn("text-xs tabular-nums", statusColor)} style={{ fontFamily: "'DM Mono', monospace" }}>
          {formatCurrency(spent)} / {formatCurrency(allocated)}
        </span>
      </div>
      <Progress value={pct} className="h-1.5" indicatorClassName={indicatorColor} />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{pct.toFixed(0)}%</span>
        {over ? (
          <span className="text-destructive" style={{ fontFamily: "'DM Mono', monospace" }}>
            +{formatCurrency(spent - allocated)} over
          </span>
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400" style={{ fontFamily: "'DM Mono', monospace" }}>
            {formatCurrency(allocated - spent)} left
          </span>
        )}
      </div>
    </div>
  );
}
