"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface BudgetDonutProps {
  label: string;
  spent: number;
  allocated: number;
  color: string;
  labelClass: string;
}

export function BudgetDonut({ label, spent, allocated, color, labelClass }: BudgetDonutProps) {
  const over = spent > allocated;
  const remaining = Math.max(0, allocated - spent);
  const pct = allocated > 0 ? Math.min((spent / allocated) * 100, 100) : 0;

  const data = allocated > 0
    ? [{ value: Math.min(spent, allocated) }, { value: remaining }]
    : [{ value: 1 }];

  const spentColor = over ? "#ef4444" : color;
  const trackColor = "#e2e8f0";

  return (
    <div className="flex flex-col items-center gap-2">
      <p className={cn("text-xs font-medium uppercase tracking-wider", labelClass)}>{label}</p>

      <div className="relative w-full" style={{ height: 110 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={36}
              outerRadius={50}
              startAngle={90}
              endAngle={-270}
              paddingAngle={allocated > 0 && remaining > 0 ? 3 : 0}
              dataKey="value"
              animationBegin={0}
              animationDuration={600}
              strokeWidth={0}
            >
              <Cell fill={allocated > 0 ? spentColor : trackColor} />
              {allocated > 0 && <Cell fill={trackColor} />}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-base font-semibold tabular-nums"
            style={{ fontFamily: "'DM Mono', monospace", color: allocated > 0 ? spentColor : "#94a3b8" }}
          >
            {allocated > 0 ? `${pct.toFixed(0)}%` : "—"}
          </span>
        </div>
      </div>

      <div className="text-center space-y-0.5">
        <p
          className="text-sm font-medium tabular-nums text-foreground"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          {formatCurrency(spent)}
        </p>
        {allocated > 0 ? (
          over ? (
            <p
              className="text-xs tabular-nums text-destructive"
              style={{ fontFamily: "'DM Mono', monospace" }}
            >
              +{formatCurrency(spent - allocated)} over
            </p>
          ) : (
            <p
              className="text-xs tabular-nums text-muted-foreground"
              style={{ fontFamily: "'DM Mono', monospace" }}
            >
              {formatCurrency(remaining)} left
            </p>
          )
        ) : (
          <p className="text-xs text-muted-foreground">no budget set</p>
        )}
      </div>
    </div>
  );
}
