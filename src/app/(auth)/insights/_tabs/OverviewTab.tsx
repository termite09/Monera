import { formatCurrency, getCategoryColor, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import type { buildReport } from "@/lib/reports";

type Report = ReturnType<typeof buildReport>;

interface Props {
  report: Report;
  savingsRate: number | null;
}

export function OverviewTab({ report, savingsRate }: Props) {
  if (report.txCount === 0) {
    return (
      <Card className="rounded-2xl border-border/70">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm">No spending this period</p>
          <p className="text-muted-foreground/50 text-xs mt-1">Upload a statement or add transactions to see reports</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <CardContent className="p-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
              Savings Rate
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Income minus all spending, shown as a percentage.</p>
            <p className={cn("mt-2 text-xl leading-none font-medium tabular-nums font-mono", savingsRate !== null && savingsRate >= 20 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
              {savingsRate === null ? "—" : `${savingsRate}%`}
            </p>
            {savingsRate !== null && (
              <p className="mt-1 text-xs text-muted-foreground">{savingsRate >= 20 ? "on track" : "below 20%"}</p>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <CardContent className="p-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
              Projected
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Estimated total by payday at your current pace.</p>
            <p className="mt-2 text-xl leading-none font-medium tabular-nums font-mono text-foreground">
              {report.daysElapsed < 3 ? "—" : formatCurrency(report.projectedTotal)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{report.daysElapsed < 3 ? "need more data" : "at current pace"}</p>
          </CardContent>
        </Card>
      </div>

      {report.prevTotal > 0 ? (
        <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              vs Last Period
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              How each category changed from last to current period. Green means you spent less.
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex flex-col gap-0">
            <div className="flex items-center justify-between pb-1.5 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
              <span />
              <div className="flex items-center gap-2">
                <span>Last</span>
                <span className="opacity-0 pointer-events-none"><ArrowRight size={12} /></span>
                <span>This period</span>
                <span className="ml-1 min-w-14 text-right">Change</span>
              </div>
            </div>
            {(() => {
              const diff = report.totalSpent - report.prevTotal;
              const better = diff <= 0;
              return (
                <div className="flex items-center justify-between py-2.5 border-b border-border/60">
                  <span className="text-sm font-medium text-foreground">Total</span>
                  <div className="flex items-center gap-2 text-sm tabular-nums font-mono">
                    <span className="text-muted-foreground">{formatCurrency(report.prevTotal)}</span>
                    <ArrowRight size={12} className="text-muted-foreground/50 shrink-0" />
                    <span className="font-semibold text-foreground">{formatCurrency(report.totalSpent)}</span>
                    <span className={cn("text-xs font-medium ml-1 min-w-14 text-right", better ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                      {better ? "↓" : "↑"}{formatCurrency(Math.abs(diff))}
                    </span>
                  </div>
                </div>
              );
            })()}
            {(["Needs", "Wants", "Savings", "Uncategorized"] as const).map((cat) => {
              const curr = report.byCategory.find((c) => c.category === cat)?.total ?? 0;
              const prev = report.prevByCategory[cat] ?? 0;
              if (curr === 0 && prev === 0) return null;
              const diff = curr - prev;
              const better = diff <= 0;
              return (
                <div key={cat} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <span className="size-2 rounded-full shrink-0" style={{ background: getCategoryColor(cat) }} />
                    {cat}
                  </span>
                  <div className="flex items-center gap-2 text-sm tabular-nums font-mono">
                    <span className="text-muted-foreground">{formatCurrency(prev)}</span>
                    <ArrowRight size={12} className="text-muted-foreground/50 shrink-0" />
                    <span className="text-foreground">{formatCurrency(curr)}</span>
                    <span className={cn("text-xs font-medium ml-1 min-w-14 text-right", diff === 0 ? "invisible" : better ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                      {diff !== 0 && (better ? "↓" : "↑")}{diff !== 0 ? formatCurrency(Math.abs(diff)) : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border-border/70">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">No previous period to compare yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs mx-auto">
              Once the period before this one has spending, you&apos;ll see a category-by-category comparison here.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
