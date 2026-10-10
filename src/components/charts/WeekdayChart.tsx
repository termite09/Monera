"use client";

import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency, cn } from "@/lib/utils";
import { fullDayName, type WeekdayPoint } from "@/lib/weekday";

interface WeekdayChartProps {
  data: WeekdayPoint[];
  onDayClick?: (point: WeekdayPoint) => void;
  /** Shown when every bar is empty. */
  emptyLabel: string;
}

/** Spent, refunded and the net — the same net the bar shows. */
function BarTooltip({ active, payload }: { active?: boolean; payload?: { payload: WeekdayPoint }[] }) {
  if (!active || !payload?.length) return null;
  const { spent, refunded, amount } = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 flex flex-col gap-1 min-w-32 font-mono text-xs">
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Spent</span>
        <span className="text-foreground">{formatCurrency(spent)}</span>
      </div>
      {refunded > 0 && (
        <>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Refunded</span>
            <span className="text-foreground">−{formatCurrency(refunded)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border pt-1 font-semibold">
            <span>Net</span>
            <span className="text-foreground">{formatCurrency(amount)}</span>
          </div>
        </>
      )}
    </div>
  );
}

export function WeekdayChart({ data, onDayClick, emptyLabel }: WeekdayChartProps) {
  if (data.every((d) => d.amount === 0)) {
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground h-40 md:h-48">
        {emptyLabel}
      </div>
    );
  }

  // Mobile renders at a fixed height; on desktop the chart fills its (fixed-height)
  // card via flex, so the bars grow to use the available vertical space.
  return (
    <div className="md:h-full md:flex md:flex-col">
      <div className="h-36 md:h-44" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="day" hide />
            <Tooltip content={<BarTooltip />} cursor={{ fill: "var(--secondary)", opacity: 0.6 }} />
            <Bar
              dataKey="amount"
              radius={[4, 4, 0, 0]}
              animationDuration={600}
              style={onDayClick ? { cursor: "pointer" } : undefined}
              onClick={onDayClick ? (bar) => onDayClick(bar.payload as WeekdayPoint) : undefined}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.day}
                  fill={entry.future ? "var(--secondary)" : entry.isMax ? "var(--primary)" : "var(--chart-bar)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Day labels double as the keyboard/screen-reader way into each bar. */}
      <div className="grid grid-cols-7 border-t border-border pt-1 md:shrink-0">
        {data.map((entry) => {
          const spoken = `${fullDayName(entry.day)}: ${formatCurrency(entry.amount)} spent`;
          const cls = cn("py-1 text-xs text-center rounded-md", entry.isMax ? "font-semibold text-foreground" : "text-muted-foreground");
          return onDayClick && !entry.future ? (
            <button
              key={entry.day}
              type="button"
              onClick={() => onDayClick(entry)}
              aria-label={`${spoken}. Show transactions`}
              className={cn(cls, "hover:text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
            >
              {entry.day}
            </button>
          ) : (
            <span key={entry.day} className={cls} aria-label={spoken}>{entry.day}</span>
          );
        })}
      </div>
    </div>
  );
}
