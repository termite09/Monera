import { SafeToSpend } from "@/lib/safeToSpend";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Props {
  safeInfo: SafeToSpend;
}

export function SafeToSpendSheet({ safeInfo }: Props) {
  return (
    <>
      <SheetHeader className="shrink-0 mb-0.5">
        <SheetTitle>Safe to spend</SheetTitle>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-2">
        <div className="bg-secondary/50 rounded-xl px-6 py-5 flex flex-col gap-2 font-mono text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Income</span>
            <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(safeInfo.income)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Spent so far</span>
            <span className="text-foreground">− {formatCurrency(safeInfo.spentSoFar)}</span>
          </div>
          {safeInfo.savedSoFar > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Saved so far</span>
              <span className="text-foreground">− {formatCurrency(safeInfo.savedSoFar)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Upcoming bill payments</span>
            <span className="text-foreground">− {formatCurrency(safeInfo.billsDue)}</span>
          </div>
          {safeInfo.savingsRemaining > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Still to set aside for savings</span>
              <span className="text-foreground">− {formatCurrency(safeInfo.savingsRemaining)}</span>
            </div>
          )}
          <div className="border-t border-border pt-2 flex items-center justify-between font-semibold">
            <span>Safe to spend</span>
            <span className={safeInfo.safe >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
              {formatCurrency(safeInfo.safe)}
            </span>
          </div>
        </div>

        {safeInfo.billItems.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 px-1">Upcoming bill payments</p>
            <div className="rounded-xl border border-border divide-y divide-border">
              {safeInfo.billItems.map((b, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(b.date)}</p>
                  </div>
                  <span className="text-sm tabular-nums font-mono text-foreground shrink-0">{formatCurrency(b.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          What&apos;s left after your spending so far, money set aside for savings, and upcoming bill payments
          {safeInfo.daysLeft > 0 ? ` (${safeInfo.daysLeft} day${safeInfo.daysLeft === 1 ? "" : "s"} away)` : ""}.
        </p>
      </div>
    </>
  );
}
