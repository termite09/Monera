import { Transaction } from "@/types";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency, formatDate, cleanDescription } from "@/lib/utils";

interface Props {
  periodSavingsTxs: Transaction[];
  onSettings: () => void;
}

export function SavingsSheet({ periodSavingsTxs, onSettings }: Props) {
  return (
    <>
      <SheetHeader className="shrink-0 mb-0.5">
        <SheetTitle>Savings this period</SheetTitle>
      </SheetHeader>
      <p className="shrink-0 text-xs text-muted-foreground mb-2">
        Transactions categorised as Savings — transfers, insurance, or any recurring bill marked Savings.
      </p>
      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-border">
        {periodSavingsTxs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center">No savings transactions this period.</p>
        ) : periodSavingsTxs.map((tx) => (
          <div key={tx.id} className="flex items-center gap-3 py-1.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground break-words">{cleanDescription(tx.description)}</p>
              <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
            </div>
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 tabular-nums font-mono shrink-0">
              {formatCurrency(tx.amount)}
            </span>
          </div>
        ))}
      </div>
      <button
        onClick={onSettings}
        className="shrink-0 mt-1.5 pt-1.5 border-t border-border text-left text-xs text-primary hover:underline"
      >
        Change your Savings budget in Settings →
      </button>
    </>
  );
}
