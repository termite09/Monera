import { SafeToSpend } from "@/lib/safeToSpend";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency, formatShortDate } from "@/lib/utils";

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
            <span className="text-foreground">{formatCurrency(safeInfo.income)}</span>
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
            <span className="text-muted-foreground">Bills still due</span>
            <span className="text-foreground">− {formatCurrency(safeInfo.billsDue)}</span>
          </div>
          {safeInfo.savingsSetAside > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Rest of savings target</span>
              <span className="text-foreground">− {formatCurrency(safeInfo.savingsSetAside)}</span>
            </div>
          )}
          <div className="border-t border-border pt-2 flex items-center justify-between font-semibold">
            <span>Safe to spend</span>
            <span className={safeInfo.safe >= 0 ? "text-foreground" : "text-destructive"}>
              {formatCurrency(safeInfo.safe)}
            </span>
          </div>
        </div>

        {safeInfo.billItems.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 px-1">Bills still due</p>
            <div className="rounded-xl border border-border divide-y divide-border">
              {safeInfo.billItems.map((b) => (
                <div key={`${b.date}-${b.name}`} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatShortDate(b.date)} · {b.estimated ? "expected subscription" : b.category === "Savings" ? "savings transfer" : b.source === "recurring" ? "regular bill" : "added by you"}
                    </p>
                  </div>
                  <span className="text-sm tabular-nums font-mono text-foreground shrink-0">{formatCurrency(b.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          What&apos;s left of your pay once your spending so far, the bills still to come before payday, and the rest of your savings target are taken out.
        </p>
      </div>
    </>
  );
}
