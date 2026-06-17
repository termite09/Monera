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

  const data = allocated > 0
    ? [{ value: Math.min(spent, allocated) }, { value: remaining }]
    : [{ value: 1 }];

  const spentColor = over ? "#ef4444" : color;
  const trackColor = "#e2e8f0";

  return (
    <div className="flex flex-col items-center gap-2.5">
      <p className={cn("text-xs font-semibold uppercase tracking-wider", labelClass)}>{label}</p>

      <div className="relative w-full" style={{ height: 130 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={44}
              outerRadius={60}
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

        <div className="absolute inset-0 flex flex-col items-center justify-center px-1">
          <span
            className={cn(
              "text-lg font-bold tabular-nums leading-none text-center",
              over ? "text-destructive" : allocated > 0 ? "text-foreground" : "text-muted-foreground"
            )}
            style={{ fontFamily: "'DM Mono', monospace" }}
          >
            {allocated > 0 ? formatCurrency(over ? spent - allocated : remaining) : "—"}
          </span>
          {allocated > 0 && (
            <span className="text-[11px] font-medium text-muted-foreground leading-none mt-1.5">
              {over ? "over" : "left"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
