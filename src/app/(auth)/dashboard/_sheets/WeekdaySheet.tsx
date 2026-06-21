import { Transaction } from "@/types";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency, formatDate, cleanDescription, cn } from "@/lib/utils";

interface Props {
  weekdayTxs: Transaction[];
  chartDateRange: string;
  title: string;
}

export function WeekdaySheet({ weekdayTxs, chartDateRange, title }: Props) {
  return (
    <>
      <SheetHeader className="shrink-0 mb-0.5">
        <SheetTitle>{title}</SheetTitle>
      </SheetHeader>
      <p className="shrink-0 text-xs text-muted-foreground mb-1.5">{chartDateRange}</p>
      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-border">
        {weekdayTxs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center">No transactions for this selection.</p>
        ) : weekdayTxs.map((tx) => (
          <div key={tx.id} className="flex items-center gap-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground break-words">{cleanDescription(tx.description)}</p>
              <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
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
