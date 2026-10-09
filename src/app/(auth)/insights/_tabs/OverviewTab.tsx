import { formatCurrency, getCategoryColor, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ArrowDown, ArrowUp } from "lucide-react";
import type { buildReport } from "@/lib/reports";

type Report = ReturnType<typeof buildReport>;

interface Props {
  report: Report;
  savingsRate: number | null;
  /** The dashboard's Safe to spend (null outside the live period). */
  safeToSpend: number | null;
  /** The user's own savings target, as a % of income. */
  savingsTargetPct: number;
}

export function OverviewTab({ report, savingsRate, safeToSpend, savingsTargetPct }: Props) {
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
            <p className="text-xs text-muted-foreground mt-0.5 max-w-[65ch]">Share of your income moved to savings this period.</p>
            <p className={cn("mt-2 text-2xl leading-none font-medium tabular-nums font-mono text-foreground")}>
              {savingsRate === null ? "—" : `${savingsRate}%`}
            </p>
            {savingsRate !== null && (
              <p className="mt-1 text-xs text-muted-foreground">{savingsRate >= savingsTargetPct
                ? `On your ${savingsTargetPct}% target`
                : report.comparedToSamePoint
                  ? `So far · your target is ${savingsTargetPct}%`
                  : `Under your ${savingsTargetPct}% target`}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            {report.comparedToSamePoint && safeToSpend !== null ? (
              <>
                <h2 className="text-sm font-semibold text-foreground">Until payday</h2>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-[65ch]">Everyday spending still to come at your current pace. Bills are already taken out of Safe to spend.</p>
                <p className="mt-2 text-2xl leading-none font-medium tabular-nums font-mono text-foreground">
                  {report.daysElapsed < 3 ? "—" : <>~{formatCurrency(report.projectedPace)}</>}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {report.daysElapsed < 3
                    ? "Needs a few more days"
                    : report.projectedPace <= safeToSpend
                      ? <>Leaves about <span className="font-mono tabular-nums text-foreground">{formatCurrency(safeToSpend - report.projectedPace)}</span> of your <span className="font-mono tabular-nums">{formatCurrency(safeToSpend)}</span> safe to spend</>
                      : <>About <span className="font-mono tabular-nums text-foreground">{formatCurrency(report.projectedPace - safeToSpend)}</span> more than your <span className="font-mono tabular-nums">{formatCurrency(Math.max(0, safeToSpend))}</span> safe to spend</>}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-foreground">Spent this period</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Needs and Wants. Savings not included.</p>
                <p className="mt-2 text-2xl leading-none font-medium tabular-nums font-mono text-foreground">{formatCurrency(report.spending)}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {report.prevSpending > 0 && report.spending > 0 ? (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-lg font-semibold text-foreground">
              <h2>Compared with last period</h2>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-[65ch]">
              {report.comparedToSamePoint
                ? "Spending so far, against last pay period up to the same day."
                : "How each category changed since last pay period."}
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex flex-col gap-0">
            <div className="flex items-center justify-between pb-1.5 text-xs font-medium text-muted-foreground">
              <span />
              <div className="flex items-center gap-2">
                <span>{report.comparedToSamePoint ? "Last period, same day" : "Last period"}</span>
                <span className="opacity-0 pointer-events-none"><ArrowRight size={12} /></span>
                <span>This period</span>
                <span className="ml-1 min-w-14 text-right">Change</span>
              </div>
            </div>
            {(() => {
              // Not-yet-sorted spending counts as Wants, as on the dashboard.
              const cur = (c: "Needs" | "Wants" | "Savings" | "Uncategorized") => report.byCategory.find((x) => x.category === c)?.total ?? 0;
              const rows = [
                { key: "Needs" as const, label: "Needs", curr: cur("Needs"), prev: report.prevByCategory.Needs },
                {
                  key: "Wants" as const,
                  label: cur("Uncategorized") + report.prevByCategory.Uncategorized > 0 ? "Wants (incl. not sorted)" : "Wants",
                  curr: cur("Wants") + cur("Uncategorized"),
                  prev: report.prevByCategory.Wants + report.prevByCategory.Uncategorized,
                },
              ];
              const row = (label: React.ReactNode, prev: number, curr: number, better: boolean, strong = false, swatch?: string) => (
                <div className={cn("flex items-center justify-between py-2.5 border-b border-border/60", strong && "font-medium")}>
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    {swatch && <span className="size-2 rounded-sm shrink-0" style={{ background: swatch }} aria-hidden />}
                    {label}
                  </span>
                  <div className="flex items-center gap-2 text-sm tabular-nums font-mono">
                    <span className="text-muted-foreground">{formatCurrency(prev)}</span>
                    <ArrowRight size={12} className="text-muted-foreground shrink-0" aria-hidden />
                    <span className={cn("text-foreground", strong && "font-semibold")}>{formatCurrency(curr)}</span>
                    <Change diff={curr - prev} better={better} />
                  </div>
                </div>
              );
              const savedNow = cur("Savings");
              const savedBefore = report.prevByCategory.Savings;
              return (
                <>
                  {rows.map((r) => (r.curr === 0 && r.prev === 0 ? null : (
                    <div key={r.key}>{row(r.label, r.prev, r.curr, r.curr - r.prev <= 0, false, getCategoryColor(r.key))}</div>
                  )))}
                  {row("Total spent", report.prevSpending, report.spending, report.spending - report.prevSpending <= 0, true)}
                  {(savedNow > 0 || savedBefore > 0) && (
                    <div className="pt-3">
                      <p className="text-xs text-muted-foreground pb-1">Not counted as spending</p>
                      {row("Moved to savings", savedBefore, savedNow, savedNow - savedBefore >= 0, false, getCategoryColor("Savings"))}
                    </div>
                  )}
                </>
              );
            })()}
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
      className="inline-flex items-center justify-end gap-0.5 text-xs ml-1 min-w-14 text-right text-foreground"
      aria-label={`${diff < 0 ? "Down" : "Up"} ${formatCurrency(Math.abs(diff))}, ${better ? "better" : "worse"} than last period`}
      title={better ? "Better than last period" : "Worse than last period"}
    >
      <Icon size={12} aria-hidden />
      {formatCurrency(Math.abs(diff))}
    </span>
  );
}
