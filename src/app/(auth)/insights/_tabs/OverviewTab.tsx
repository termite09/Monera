import { formatCurrency, getCategoryColor, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ArrowDown, ArrowUp } from "lucide-react";
import type { buildReport } from "@/lib/reports";

type Report = ReturnType<typeof buildReport>;

interface Props {
  report: Report;
  savingsRate: number | null;
}

export function OverviewTab({ report, savingsRate }: Props) {
  if (report.txCount === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm">No spending this period</p>
          <p className="text-muted-foreground text-xs mt-1">Add a statement or a transaction to see how this period is going.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-foreground">Savings rate</h2>
            <p className="text-xs text-muted-foreground mt-0.5">How much of your income you kept.</p>
            <p className={cn("mt-2 text-xl leading-none font-medium tabular-nums font-mono", savingsRate !== null && savingsRate >= 20 ? "text-status-ok" : "text-foreground")}>
              {savingsRate === null ? "—" : `${savingsRate}%`}
            </p>
            {savingsRate !== null && (
              <p className="mt-1 text-xs text-muted-foreground">{savingsRate >= 20 ? "On track" : "Below 20%"}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-foreground">By payday</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Your spending so far plus day-to-day spending at this pace. Savings not included.</p>
            <p className="mt-2 text-xl leading-none font-medium tabular-nums font-mono text-foreground">
              {report.daysElapsed < 3 ? "—" : formatCurrency(report.projectedTotal)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{report.daysElapsed < 3 ? "Needs a few more days" : "At your current pace"}</p>
          </CardContent>
        </Card>
      </div>

      {report.prevTotal > 0 && report.totalSpent > 0 ? (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-foreground">
              <h2>Compared with last period</h2>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {report.comparedToSamePoint
                ? `Spending so far, against the same ${report.daysElapsed} days of last pay period.`
                : "How each category changed since last pay period."}
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex flex-col gap-0">
            <div className="flex items-center justify-between pb-1.5 text-xs font-medium text-muted-foreground">
              <span />
              <div className="flex items-center gap-2">
                <span>{report.comparedToSamePoint ? "Same day last time" : "Last"}</span>
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
                    <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                    <span className="font-semibold text-foreground">{formatCurrency(report.totalSpent)}</span>
                    <Change diff={diff} better={better} />
                  </div>
                </div>
              );
            })()}
            {(["Needs", "Wants", "Savings", "Uncategorized"] as const).map((cat) => {
              const curr = report.byCategory.find((c) => c.category === cat)?.total ?? 0;
              const prev = report.prevByCategory[cat] ?? 0;
              if (curr === 0 && prev === 0) return null;
              const diff = curr - prev;
              // Saving more is the good direction; for spending it's the reverse.
              const better = cat === "Savings" ? diff >= 0 : diff <= 0;
              return (
                <div key={cat} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <span className="size-2 rounded-sm shrink-0" style={{ background: getCategoryColor(cat) }} aria-hidden />
                    {cat}
                  </span>
                  <div className="flex items-center gap-2 text-sm tabular-nums font-mono">
                    <span className="text-muted-foreground">{formatCurrency(prev)}</span>
                    <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                    <span className="text-foreground">{formatCurrency(curr)}</span>
                    <Change diff={diff} better={better} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">No previous period to compare yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              Once the period before this one has spending, you&apos;ll see a category-by-category comparison here.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

/** Change since last period: arrow shows direction, colour shows whether that's good. */
function Change({ diff, better }: { diff: number; better: boolean }) {
  if (diff === 0) return <span className="ml-1 min-w-14" aria-hidden />;
  const Icon = diff < 0 ? ArrowDown : ArrowUp;
  return (
    <span
      className={cn("inline-flex items-center justify-end gap-0.5 text-xs ml-1 min-w-14 text-right", better ? "text-foreground" : "text-foreground font-semibold")}
      aria-label={`${diff < 0 ? "Down" : "Up"} ${formatCurrency(Math.abs(diff))}`}
    >
      <Icon size={12} aria-hidden />
      {formatCurrency(Math.abs(diff))}
    </span>
  );
}
