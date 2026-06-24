import { MonthSummary } from "@/types";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/utils";

interface Props {
  summary: MonthSummary;
  salaryBasis: number;
  incomeIsDetected: boolean;
  configuredIncome: number;
  additionalIncome: number;
  onReview: () => void;
}

export function RemainingSheet({ summary, salaryBasis, incomeIsDetected, configuredIncome, additionalIncome, onReview }: Props) {
  return (
    <>
      <SheetHeader className="shrink-0 mb-0.5">
        <SheetTitle>Remaining budget</SheetTitle>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-2">
        <div className="bg-secondary/50 rounded-xl px-3 py-3 flex flex-col gap-2 font-mono text-sm">
          {salaryBasis > 0 && incomeIsDetected ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{configuredIncome > 0 ? "Planned (this period)" : "Planned income"}</span>
                <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(salaryBasis)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">+ Received</span>
                <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(additionalIncome)}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Income</span>
              <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(summary.income)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Spending</span>
            <span className="text-foreground">− {formatCurrency(summary.totalExpenses - summary.savings)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Savings</span>
            <span className="text-foreground">− {formatCurrency(summary.savings)}</span>
          </div>
          <div className="border-t border-border pt-2 flex items-center justify-between font-semibold">
            <span>Remaining</span>
            <span className={summary.remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
              {formatCurrency(summary.remaining)}
            </span>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <p className="text-xs text-muted-foreground flex-1">
            Income minus all your spending this period.{" "}
            {summary.remaining >= 0 ? "You're within budget." : "You've overspent this period."}
          </p>
          <button onClick={onReview} className="text-xs text-primary hover:underline shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded">
            Review →
          </button>
        </div>
      </div>
    </>
  );
}
