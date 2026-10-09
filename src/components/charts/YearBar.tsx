"use client";

import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Transaction } from "@/types";
import { cn, formatCurrency } from "@/lib/utils";
import { monthlyCategoryTotals } from "@/lib/reports";
import { MONTH_NAMES } from "@/config/constants";

interface YearBarProps {
  transactions: Transaction[];
  year: number;
  paydayOfMonth?: number;
  onMonthClick?: (monthKey: string) => void;
}

const SERIES = [
  { key: "needs", name: "Needs", color: "var(--cat-needs)" },
  { key: "wants", name: "Wants", color: "var(--cat-wants)" },
  { key: "savings", name: "Savings", color: "var(--cat-savings)" },
] as const;

export function YearBar({ transactions, year, paydayOfMonth = 1, onMonthClick }: YearBarProps) {
  const totals = monthlyCategoryTotals(transactions, year, paydayOfMonth);
  const data = MONTH_NAMES.map((name, idx) => ({
    month: name.slice(0, 3),
    fullMonth: name,
    monthKey: `${year}-${String(idx + 1).padStart(2, "0")}`,
    ...totals[idx],
  }));

  return (
    <div>
      <div className="h-56" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
            style={onMonthClick ? { cursor: "pointer" } : undefined}
            onClick={onMonthClick ? (chartData) => {
              const idx = chartData?.activeTooltipIndex;
              if (typeof idx === "number" && data[idx]?.monthKey) onMonthClick(data[idx].monthKey);
            } : undefined}
          >
            <XAxis dataKey="month" hide />
            <Tooltip
              formatter={(v) => formatCurrency(v as number)}
              cursor={{ fill: "var(--secondary)", opacity: 0.6 }}
              contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }}
            />
            {SERIES.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="a"
                fill={s.color}
                name={s.name}
                radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                animationDuration={600}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Period labels double as the keyboard/screen-reader way into each bar. */}
      <div className="grid grid-cols-12 border-t border-border pt-1">
        {data.map((d) => {
          const total = d.needs + d.wants + d.savings;
          const spoken = `${d.fullMonth} pay period: ${formatCurrency(total)}`;
          return onMonthClick ? (
            <button
              key={d.monthKey}
              type="button"
              onClick={() => onMonthClick(d.monthKey)}
              aria-label={`${spoken}. Open on the dashboard`}
              className={cn(
                "py-1 text-xs text-center rounded-md text-muted-foreground",
                "hover:text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
            >
              {d.month}
            </button>
          ) : (
            <span key={d.monthKey} className="py-1 text-xs text-center text-muted-foreground" aria-label={spoken}>{d.month}</span>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-2 px-1 justify-end">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden /> {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
