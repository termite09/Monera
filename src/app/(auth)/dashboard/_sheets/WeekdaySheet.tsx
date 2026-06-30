import { Transaction } from "@/types";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency, formatDate, cleanDescription, cn } from "@/lib/utils";

interface Props {
  weekdayTxs: Transaction[];
  chartDateRange: string;
  title: string;
}

export function WeekdaySheet({ weekdayTxs, chartDateRange, title }: Props) {
  const spent = weekdayTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const received = weekdayTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const net = spent - received;
  // Every row shares one date when this is a single-day drill-down (week mode) —
  // repeating it per row would just be noise, so only show it when rows span
  // multiple distinct dates (period/month/year modes aggregate one weekday across weeks).
  const sameDate = weekdayTxs.length > 0 && weekdayTxs.every((t) => t.date === weekdayTxs[0].date);

  return (
    <>
      <SheetHeader className="shrink-0 mb-0.5">
        <SheetTitle>{title}</SheetTitle>
      </SheetHeader>
      <p className="shrink-0 text-xs text-muted-foreground mb-2">{chartDateRange}</p>
      {weekdayTxs.length > 0 && (
        <div className="shrink-0 bg-secondary/50 rounded-xl px-3 py-3 mb-2 flex flex-col gap-2 font-mono text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Spent</span>
            <span className="text-foreground">− {formatCurrency(spent)}</span>
          </div>
          {received > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Received</span>
              <span className="text-emerald-600 dark:text-emerald-400">+ {formatCurrency(received)}</span>
            </div>
          )}
          <div className="border-t border-border pt-2 flex items-center justify-between font-semibold">
            <span>Net</span>
            <span className={net <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}>
              {net > 0 ? "− " : net < 0 ? "+ " : ""}{formatCurrency(Math.abs(net))}
            </span>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-border pr-2 -mr-2">
        {weekdayTxs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center">No transactions for this selection.</p>
        ) : weekdayTxs.map((tx) => (
          <div key={tx.id} className="flex items-center gap-3 py-1.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground wrap-break-word leading-snug">{cleanDescription(tx.description)}</p>
              {!sameDate && <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>}
            </div>
            <span className={cn(
              "text-sm tabular-nums font-mono shrink-0",
              tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
            )}>
              {tx.type === "income" ? "+" : "−"}{formatCurrency(tx.amount)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
