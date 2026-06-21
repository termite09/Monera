import { Transaction, Category, MonthSummary } from "@/types";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency, formatDate, cleanDescription, cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface Props {
  summary: MonthSummary;
  uncategorizedExpense: number;
  periodExpenseTxs: Transaction[];
  expandedCat: string | null;
  setExpandedCat: (cat: string | null) => void;
}

export function ExpensesSheet({ summary, uncategorizedExpense, periodExpenseTxs, expandedCat, setExpandedCat }: Props) {
  const categories: { label: string; amount: number; dot: string; key: Category }[] = [
    { label: "Needs", amount: summary.needs, dot: "bg-blue-500", key: "Needs" },
    { label: "Wants", amount: summary.wants, dot: "bg-amber-500", key: "Wants" },
    ...(uncategorizedExpense > 0
      ? [{ label: "Uncategorized", amount: uncategorizedExpense, dot: "bg-muted-foreground/40", key: "Uncategorized" as Category }]
      : []),
  ];

  return (
    <>
      <SheetHeader className="shrink-0 mb-0.5">
        <SheetTitle>Expenses this period</SheetTitle>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-0.5 pb-1">
        {categories.map((cat) => {
          const isOpen = expandedCat === cat.key;
          const catTxs = periodExpenseTxs.filter((tx) => tx.category === cat.key);
          return (
            <div key={cat.key}>
              <button
                onClick={() => setExpandedCat(isOpen ? null : cat.key)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary transition-colors text-left w-full"
              >
                <span className={cn("size-2.5 rounded-full shrink-0", cat.dot)} />
                <span className="flex-1 text-sm font-medium">{cat.label}</span>
                <span className="text-sm tabular-nums font-mono text-foreground mr-1">{formatCurrency(cat.amount)}</span>
                <ChevronRight size={14} className={cn("text-muted-foreground/50 shrink-0 transition-transform duration-200", isOpen && "rotate-90")} />
              </button>
              {isOpen && (
                <div className="mx-3 mb-1 rounded-xl border border-border overflow-hidden">
                  {catTxs.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 px-4">No transactions</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {catTxs.map((tx) => (
                        <div key={tx.id} className="flex items-center gap-3 px-4 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground break-words">{cleanDescription(tx.description)}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                          </div>
                          <span className="text-sm tabular-nums font-mono text-foreground shrink-0">
                            {formatCurrency(tx.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="shrink-0 text-xs text-muted-foreground pt-2 border-t border-border">
        Tap a category to expand its transactions. Savings are shown separately.
      </p>
    </>
  );
}
