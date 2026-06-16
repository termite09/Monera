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

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "text-sm font-semibold tabular-nums leading-tight",
              over ? "text-destructive" : allocated > 0 ? "text-foreground" : "text-muted-foreground"
            )}
            style={{ fontFamily: "'DM Mono', monospace" }}
          >
            {allocated > 0 ? formatCurrency(over ? spent - allocated : remaining) : "—"}
          </span>
          {allocated > 0 && (
            <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
              {over ? "over" : "left"}
            </span>
          )}
        </div>
      </div>

      <div className="text-center">
        {allocated > 0 ? (
          <p
            className="text-xs tabular-nums text-muted-foreground"
            style={{ fontFamily: "'DM Mono', monospace" }}
          >
            {formatCurrency(spent)} / {formatCurrency(allocated)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">no budget set</p>
        )}
      </div>
    </div>
  );
}
