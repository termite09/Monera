import { MonthSummary } from "@/types";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/utils";

interface Props {
  summary: MonthSummary;
  /** Pay counted this period — the deposit if it arrived, otherwise the expected amount. */
  salaryUsed: number;
  salaryFromStatement: boolean;
  additionalIncome: number;
  onReview: () => void;
}

export function RemainingSheet({ summary, salaryUsed, salaryFromStatement, additionalIncome, onReview }: Props) {
  const row = (label: string, value: string) => (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );

  return (
    <>
      <SheetHeader className="shrink-0 mb-0.5">
        <SheetTitle>What&apos;s left this period</SheetTitle>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-2">
        {/* Every line here adds up to the total below. */}
        <div className="bg-secondary/50 rounded-xl px-3 py-3 flex flex-col gap-2 font-mono text-sm">
          {salaryUsed > 0 && row(salaryFromStatement ? "Pay" : "Expected pay", formatCurrency(salaryUsed))}
          {additionalIncome > 0 && row("+ Other money in", formatCurrency(additionalIncome))}
          {salaryUsed === 0 && additionalIncome === 0 && row("Income", formatCurrency(summary.income))}
          {row("Spending", `− ${formatCurrency(summary.totalExpenses - summary.savings)}`)}
          {row("Savings", `− ${formatCurrency(summary.savings)}`)}
          <div className="border-t border-border pt-2 flex items-center justify-between font-semibold">
            <span>Left</span>
            <span className={summary.remaining >= 0 ? "text-foreground" : "text-destructive"}>
              {summary.remaining < 0 ? "−" : ""}{formatCurrency(Math.abs(summary.remaining))}
            </span>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <p className="text-xs text-muted-foreground flex-1">
            {summary.remaining >= 0 ? "Money in, minus everything that went out this period." : "More went out than came in this period."}
          </p>
          <button type="button" onClick={onReview} className="text-xs text-primary hover:underline shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded">
            Review →
          </button>
        </div>
      </div>
    </>
  );
}
