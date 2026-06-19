"use client";

import { useState, useMemo } from "react";
import { TrendingDown, TrendingUp, Repeat, Trophy, Receipt, CalendarClock, CreditCard, Lightbulb, ArrowRight } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppData } from "@/contexts/AppDataContext";
import { useBudget } from "@/hooks/useBudget";
import { buildReport, detectSubscriptions } from "@/lib/reports";
import { buildInsights } from "@/lib/insights";
import { getRecurringInRange } from "@/lib/recurring";
import { formatCurrency, formatDate, getCategoryColor, getPeriodBounds, cn } from "@/lib/utils";

type ReportTab = "overview" | "merchants" | "subscriptions";

const REPORT_TABS: { id: ReportTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "merchants", label: "Merchants" },
  { id: "subscriptions", label: "Subscriptions" },
];

const TONE_DOT: Record<string, string> = {
  warn: "bg-amber-500",
  good: "bg-emerald-500",
  info: "bg-muted-foreground/40",
};

export default function ReportsPage() {
  const { month, setMonth, transactions, settings, isLoading } = useAppData();
  const [tab, setTab] = useState<ReportTab>("overview");
  const paydayOfMonth = settings.paydayOfMonth ?? 1;

  // Include recurring bills for BOTH the current and the previous period, so
  // buildReport's "vs last period" comparison sees the previous period's
  // recurring bills too. Generating only the current period's recurring would
  // make the previous-period totals understate by the recurring amount.
  const allTxs = useMemo(() => {
    const { start: curStart, end: curEnd } = getPeriodBounds(month, paydayOfMonth);
    const prevStart = new Date(curStart.getFullYear(), curStart.getMonth() - 1, curStart.getDate());
    const recurringTxs = getRecurringInRange(
      settings.recurringPayments ?? [],
      prevStart,
      curEnd,
      paydayOfMonth,
      settings.currency ?? "EUR"
    );
    return [...transactions, ...recurringTxs];
  }, [transactions, settings.recurringPayments, settings.currency, month, paydayOfMonth]);

  const report = useMemo(() => buildReport(allTxs, month, paydayOfMonth), [allTxs, month, paydayOfMonth]);
  const { summary, budgetAllocations, incomeIsDetected } = useBudget(allTxs, settings, month);
  const insights = buildInsights(allTxs, settings, month, summary, budgetAllocations);

  // Subscriptions span all history, not just the selected period.
  const subscriptions = useMemo(() => detectSubscriptions(transactions), [transactions]);
  const subsMonthly = subscriptions.reduce((s, sub) => s + sub.amount, 0);

  const maxMerchantTotal = Math.max(1, ...report.topMerchants.map((m) => m.total));

  const emptyPeriod = (
    <Card className="rounded-2xl border-border/70">
      <CardContent className="py-12 text-center">
        <p className="text-muted-foreground text-sm">No spending this period</p>
        <p className="text-muted-foreground/50 text-xs mt-1">Upload a statement or add transactions to see reports</p>
      </CardContent>
    </Card>
  );

  return (
    <PageShell>
      <Header month={month} onMonthChange={setMonth} paydayOfMonth={paydayOfMonth} isLoading={isLoading} />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-5">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Insights into your spending this period</p>
        </div>

        {/* Sub-tab switcher — one report view at a time, no endless scroll */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-secondary">
          {REPORT_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "h-9 rounded-md text-sm font-medium transition-colors",
                tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            {tab === "overview" &&
              (report.txCount === 0 ? (
                emptyPeriod
              ) : (
                <>
                  {/* Income + savings summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <StatTile compact label="Income" value={formatCurrency(summary.income)} sub={incomeIsDetected ? "from statement" : "planned"} />
                    <StatTile compact label="Saved" value={formatCurrency(summary.savings)} sub="this period" />
                    <StatTile
                      compact
                      label="Savings Rate"
                      value={summary.income > 0 ? `${Math.round((summary.savings / summary.income) * 100)}%` : "—"}
                      sub={summary.income > 0 ? (summary.savings / summary.income >= 0.2 ? "on track" : "below 20%") : undefined}
                      trend={summary.income > 0 && summary.savings / summary.income >= 0.2 ? "good" : undefined}
                    />
                  </div>

                  {/* Insights */}
                  {insights.length > 0 && (
                    <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          <Lightbulb size={13} /> Insights
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 flex flex-col gap-2.5">
                        {insights.map((i) => (
                          <div key={i.id} className="flex items-start gap-2.5 text-sm">
                            <span className={cn("mt-1.5 size-2 rounded-full shrink-0", TONE_DOT[i.tone])} />
                            <span className="text-foreground">{i.text}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Headline stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <StatTile label="Total Spent" value={formatCurrency(report.totalSpent)} sub={`${report.txCount} transactions`} />
                    <StatTile label="Avg / Day" value={formatCurrency(report.avgPerDay)} sub={`over ${report.daysElapsed} days`} />
                    <StatTile
                      label="vs Last Period"
                      value={report.changePct === null ? "—" : `${report.changePct >= 0 ? "+" : ""}${report.changePct.toFixed(0)}%`}
                      sub={report.prevTotal > 0 ? formatCurrency(report.prevTotal) + " before" : "no prior data"}
                      trend={report.changePct === null ? undefined : report.changePct <= 0 ? "good" : "bad"}
                    />
                    <StatTile label="Projected" value={formatCurrency(report.projectedTotal)} sub="at current pace" icon={<CalendarClock size={14} className="text-muted-foreground" />} />
                  </div>

                  {/* vs Last Period — category breakdown */}
                  {report.prevTotal > 0 && (
                    <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">vs Last Period</CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 flex flex-col gap-0">
                        {/* Total row */}
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
                                <span className={cn("text-xs font-medium ml-1", better ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                                  {better ? "↓" : "↑"}{formatCurrency(Math.abs(diff))}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                        {/* Per-category rows */}
                        {(["Needs", "Wants", "Savings", "Uncategorized"] as const).map((cat) => {
                          const curr = report.byCategory.find(c => c.category === cat)?.total ?? 0;
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
                                {diff !== 0 && (
                                  <span className={cn("text-xs font-medium ml-1", better ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
                                    {better ? "↓" : "↑"}{formatCurrency(Math.abs(diff))}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}

                </>
              ))}

            {tab === "merchants" &&
              (report.txCount === 0 ? (
                emptyPeriod
              ) : (
                <>
                  {/* Where your money goes (top merchants) */}
                  <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <Trophy size={13} /> Where Your Money Goes
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 flex flex-col gap-3">
                      {report.topMerchants.map((m) => (
                        <div key={m.name} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-foreground truncate pr-2">{m.name}</span>
                            <span className="font-medium tabular-nums text-foreground font-mono">{formatCurrency(m.total)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(m.total / maxMerchantTotal) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Most frequent merchants */}
                  <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <Repeat size={13} /> Most Recurring
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      {report.frequentMerchants.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">No repeat merchants yet this period.</p>
                      ) : (
                        <div className="flex flex-col divide-y divide-border">
                          {report.frequentMerchants.map((m) => (
                            <div key={m.name} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="flex items-center justify-center size-9 rounded-full bg-secondary text-xs font-semibold tabular-nums text-foreground shrink-0">{m.count}×</span>
                                <span className="text-sm text-foreground truncate">{m.name}</span>
                              </div>
                              <span className="text-sm font-medium tabular-nums text-foreground shrink-0 pl-2 font-mono">{formatCurrency(m.total)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Biggest purchases */}
                  <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <Receipt size={13} /> Biggest Purchases
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="flex flex-col divide-y divide-border">
                        {report.biggest.map((t) => (
                          <div key={t.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                            <div className="min-w-0 pr-2">
                              <p className="text-sm text-foreground truncate">{t.description}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(t.date)} · {t.category}</p>
                            </div>
                            <span className="text-sm font-medium tabular-nums text-foreground shrink-0 font-mono">{formatCurrency(t.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ))}

            {tab === "subscriptions" && (
              <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <CardHeader className="pb-2 pt-4 px-4 flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <CreditCard size={13} /> Subscriptions
                  </CardTitle>
                  {subscriptions.length > 0 && <span className="text-xs text-muted-foreground tabular-nums">~{formatCurrency(subsMonthly)}/mo</span>}
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {subscriptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No recurring subscriptions detected yet.</p>
                  ) : (
                    <div className="flex flex-col divide-y divide-border">
                      {subscriptions.map((s) => (
                        <div key={s.name} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                          <div className="min-w-0 pr-2">
                            <p className="text-sm text-foreground truncate">{s.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.months} month{s.months === 1 ? "" : "s"} · last {formatDate(s.lastDate)}
                            </p>
                          </div>
                          <span className="text-sm font-medium tabular-nums text-foreground shrink-0 font-mono">{formatCurrency(s.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}

function StatTile({
  label,
  value,
  sub,
  trend,
  icon,
  compact,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: "good" | "bad";
  icon?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] min-w-0">
      <CardContent className={compact ? "p-3" : "p-4"}>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] truncate">
          {icon}
          {label}
        </p>
        <p
          className={`leading-none font-medium tabular-nums font-mono ${compact ? "mt-1.5 text-sm" : "mt-2 text-xl"} ${
            trend === "good" ? "text-emerald-600 dark:text-emerald-400" : trend === "bad" ? "text-destructive" : "text-foreground"
          }`}
        >
          {trend === "good" && <TrendingDown size={15} className="inline mr-1 -mt-0.5" />}
          {trend === "bad" && <TrendingUp size={15} className="inline mr-1 -mt-0.5" />}
          {value}
        </p>
        {sub && <p className="mt-1 text-xs text-muted-foreground truncate">{sub}</p>}
      </CardContent>
    </Card>
  );
}
