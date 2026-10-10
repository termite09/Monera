import { Transaction } from "@/types";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency, formatDate, cleanDescription } from "@/lib/utils";
import type { WeekdayPoint } from "@/lib/weekday";

interface Props {
  point: WeekdayPoint;
  transactions: Transaction[];
  rangeLabel: string;
  title: string;
}

/** The transactions behind one bar, with the same spent / refunded / net the bar shows. */
export function WeekdaySheet({ point, transactions, rangeLabel, title }: Props) {
  // Every row shares one date when this is a single-day drill-down (week mode) —
  // repeating it per row would just be noise, so only show it when rows span
  // multiple distinct dates (period/month/year modes aggregate one weekday across weeks).
  const sameDate = transactions.length > 0 && transactions.every((t) => t.date === transactions[0].date);

  return (
    <>
      <SheetHeader className="shrink-0 mb-0.5">
        <SheetTitle>{title}</SheetTitle>
      </SheetHeader>
      <p className="shrink-0 text-xs text-muted-foreground mb-2">{rangeLabel}</p>
      {transactions.length > 0 && (
        <div className="shrink-0 bg-secondary/50 rounded-xl px-3 py-3 mb-2 flex flex-col gap-2 font-mono text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Spent</span>
            <span className="text-foreground">{formatCurrency(point.spent)}</span>
          </div>
          {point.refunded > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Refunded</span>
              <span className="text-foreground">− {formatCurrency(point.refunded)}</span>
            </div>
          )}
          <div className="border-t border-border pt-2 flex items-center justify-between font-semibold">
            <span>Net spent</span>
            <span className="text-foreground">{formatCurrency(point.amount)}</span>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-border pr-2 -mr-2">
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center">No transactions for this selection.</p>
        ) : transactions.map((tx) => (
          <div key={tx.id} className="flex items-center gap-3 py-1.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground wrap-break-word leading-snug">{cleanDescription(tx.description)}</p>
              {!sameDate && <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>}
            </div>
            <span className="text-sm tabular-nums font-mono shrink-0 text-foreground">
              {tx.type === "income" ? "+" : "−"}{formatCurrency(tx.amount)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
