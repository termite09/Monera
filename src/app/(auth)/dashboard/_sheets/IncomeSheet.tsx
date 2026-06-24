import { Transaction } from "@/types";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency, formatDate, cleanDescription } from "@/lib/utils";

interface Props {
  salaryBasis: number;
  configuredIncome: number;
  periodIncomeTxs: Transaction[];
  salaryKeywords: string[];
  onManage: () => void;
}

export function IncomeSheet({ salaryBasis, configuredIncome, periodIncomeTxs, salaryKeywords, onManage }: Props) {
  return (
    <>
      <SheetHeader className="shrink-0 mb-1">
        <SheetTitle>Income this period</SheetTitle>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto min-h-0">
        {salaryBasis > 0 && (
          <div className="flex items-center gap-3 py-1.5 border-b border-border mb-0.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {configuredIncome > 0 ? "Planned income (this period)" : "Planned monthly income"}
              </p>
              <p className="text-xs text-muted-foreground">Set in Settings → Setup</p>
            </div>
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 tabular-nums font-mono shrink-0">
              +{formatCurrency(salaryBasis)}
            </span>
          </div>
        )}
        {periodIncomeTxs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 text-center">No other income transactions this period.</p>
        ) : (
          <div className="divide-y divide-border">
            {periodIncomeTxs.map((tx) => {
              const isSalary = salaryKeywords.length > 0 &&
                salaryKeywords.some((k) => tx.description.toLowerCase().includes(k.toLowerCase()));
              return (
                <div key={tx.id} className="flex items-center gap-3 py-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground wrap-break-word">{cleanDescription(tx.description)}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
                      {isSalary && (
                        <span className="text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                          Salary
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 tabular-nums font-mono shrink-0">
                    +{formatCurrency(tx.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="shrink-0 mt-1.5 pt-1.5 border-t border-border flex items-center gap-3">
        <p className="text-xs text-muted-foreground flex-1">Excluded transactions don&apos;t appear here.</p>
        <button onClick={onManage} className="text-xs text-primary hover:underline shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded">
          Manage →
        </button>
      </div>
    </>
  );
}
