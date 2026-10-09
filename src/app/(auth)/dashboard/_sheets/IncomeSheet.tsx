import { Transaction } from "@/types";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency, formatDate, cleanDescription } from "@/lib/utils";

interface Props {
  /** Pay the user told us to expect (Basics, or a Period override). */
  salaryBasis: number;
  /** True when the pay deposit was found in the statement (it replaces salaryBasis). */
  salaryFromStatement: boolean;
  salaryTxIds: string[];
  configuredIncome: number;
  periodIncomeTxs: Transaction[];
  onManage: () => void;
}

export function IncomeSheet({ salaryBasis, salaryFromStatement, salaryTxIds, configuredIncome, periodIncomeTxs, onManage }: Props) {
  // Refunds are income tagged to a spending category; they reduce that spending
  // rather than adding to income, so they're not listed here.
  const deposits = periodIncomeTxs.filter((t) => t.category === "Uncategorized");
  const hasRefunds = deposits.length < periodIncomeTxs.length;
  const payIds = new Set(salaryTxIds);

  return (
    <>
      <SheetHeader className="shrink-0 mb-1">
        <SheetTitle>Income this period</SheetTitle>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto min-h-0">
        {!salaryFromStatement && salaryBasis > 0 && (
          <div className="flex items-center gap-3 py-1.5 border-b border-border mb-0.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Expected pay</p>
              <p className="text-xs text-muted-foreground">
                Not in your statement yet · set in Settings → {configuredIncome > 0 ? "Period" : "Basics"}
              </p>
            </div>
            <span className="text-sm font-medium text-foreground tabular-nums font-mono shrink-0">
              +{formatCurrency(salaryBasis)}
            </span>
          </div>
        )}
        {deposits.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 text-center">No money in from your statement this period yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {deposits.map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 py-1.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground wrap-break-word">{cleanDescription(tx.description)}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
                    {payIds.has(tx.id) && (
                      <span className="text-xs font-medium bg-secondary text-foreground px-1.5 py-0.5 rounded-full">Pay</span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-medium text-foreground tabular-nums font-mono shrink-0">
                  +{formatCurrency(tx.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="shrink-0 mt-1.5 pt-1.5 border-t border-border flex items-center gap-3">
        <p className="text-xs text-muted-foreground flex-1">
          {salaryFromStatement && salaryBasis > 0
            ? "Your pay arrived, so it's used instead of the amount you entered."
            : "Transactions you've left out don't appear here."}
          {hasRefunds && " Refunds are taken off your spending instead."}
        </p>
        <button type="button" onClick={onManage} className="tap-area text-xs text-primary hover:underline shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded">
          Manage →
        </button>
      </div>
    </>
  );
}
