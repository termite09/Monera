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
  /** Opens Transactions filtered to unsorted items. */
  onSort: () => void;
}

export function ExpensesSheet({ summary, uncategorizedExpense, periodExpenseTxs, expandedCat, setExpandedCat, onSort }: Props) {
  // Not-yet-sorted spending counts as Wants (the flexible budget), as it does on
  // the dashboard circle — so the numbers match wherever you look.
  const categories: { label: string; amount: number; dot: string; key: Category; includes: Category[] }[] = [
    { label: "Needs", amount: summary.needs, dot: "bg-cat-needs", key: "Needs", includes: ["Needs"] },
    { label: "Wants", amount: summary.wants + uncategorizedExpense, dot: "bg-cat-wants", key: "Wants", includes: ["Wants", "Uncategorized"] },
  ];

  return (
    <>
      <SheetHeader className="shrink-0 mb-0.5">
        <SheetTitle>Expenses this period</SheetTitle>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-0.5 pb-1">
        {categories.map((cat) => {
          const isOpen = expandedCat === cat.key;
          const catTxs = periodExpenseTxs.filter((tx) => cat.includes.includes(tx.category));
          return (
            <div key={cat.key}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setExpandedCat(isOpen ? null : cat.key)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary transition-colors text-left w-full"
              >
                <span className={cn("size-2.5 rounded-sm shrink-0", cat.dot)} aria-hidden />
                <span className="flex-1 text-sm font-medium">{cat.label}</span>
                <span className="text-sm tabular-nums font-mono text-foreground mr-1">{formatCurrency(cat.amount)}</span>
                <ChevronRight size={14} className={cn("text-muted-foreground shrink-0 transition-transform duration-200", isOpen && "rotate-90")} />
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
                            <p className="text-sm text-foreground wrap-break-word">{cleanDescription(tx.description)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(tx.date)}{tx.category === "Uncategorized" && " · not sorted yet"}
                            </p>
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
        {uncategorizedExpense > 0 && (
          <>
            Wants includes <span className="font-mono tabular-nums">{formatCurrency(uncategorizedExpense)}</span> not sorted yet.{" "}
            <button type="button" onClick={onSort} className="underline underline-offset-2 hover:text-foreground">Sort now</button>.{" "}
          </>
        )}
        Savings are shown separately.
      </p>
    </>
  );
}
