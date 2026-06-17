"use client";

import { useState, useEffect, useMemo } from "react";
import { TrendingDown, TrendingUp, Repeat, Trophy, Receipt, CalendarClock } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppData } from "@/contexts/AppDataContext";
import { buildReport } from "@/lib/reports";
import { getRecurringTransactions } from "@/lib/recurring";
import { getCurrentMonth, formatCurrency, formatDate, getCategoryColor } from "@/lib/utils";

export default function ReportsPage() {
  const { transactions, settings, isLoading } = useAppData();
  const [month, setMonth] = useState(getCurrentMonth());
  const paydayOfMonth = settings.paydayOfMonth ?? 1;

  useEffect(() => {
    setMonth(getCurrentMonth(paydayOfMonth));
  }, [paydayOfMonth]);

  const recurringTxs = useMemo(
    () => getRecurringTransactions(settings.recurringPayments ?? [], month, paydayOfMonth),
    [settings.recurringPayments, month, paydayOfMonth]
  );
  const allTxs = useMemo(() => [...transactions, ...recurringTxs], [transactions, recurringTxs]);

  const report = useMemo(
    () => buildReport(allTxs, month, paydayOfMonth),
    [allTxs, month, paydayOfMonth]
  );

  const maxMerchantTotal = Math.max(1, ...report.topMerchants.map((m) => m.total));
  const maxFreq = Math.max(1, ...report.frequentMerchants.map((m) => m.count));

  return (
    <PageShell>
      <Header month={month} onMonthChange={setMonth} paydayOfMonth={paydayOfMonth} isLoading={isLoading} />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-5">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Insights into your spending this period</p>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : report.txCount === 0 ? (
          <Card className="rounded-2xl border-border/70">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground text-sm">No spending this period</p>
              <p className="text-muted-foreground/50 text-xs mt-1">Upload a statement or add transactions to see reports</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Headline stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatTile
                label="Total Spent"
                value={formatCurrency(report.totalSpent)}
                sub={`${report.txCount} transactions`}
              />
              <StatTile
                label="Avg / Day"
                value={formatCurrency(report.avgPerDay)}
                sub={`over ${report.daysElapsed} days`}
              />
              <StatTile
                label="vs Last Period"
                value={report.changePct === null ? "—" : `${report.changePct >= 0 ? "+" : ""}${report.changePct.toFixed(0)}%`}
                sub={report.prevTotal > 0 ? formatCurrency(report.prevTotal) + " before" : "no prior data"}
                trend={report.changePct === null ? undefined : report.changePct <= 0 ? "good" : "bad"}
              />
              <StatTile
                label="Projected"
                value={formatCurrency(report.projectedTotal)}
                sub="at current pace"
                icon={<CalendarClock size={14} className="text-muted-foreground" />}
              />
            </div>

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
                      <span className="font-medium tabular-nums text-foreground font-mono">
                        {formatCurrency(m.total)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${(m.total / maxMerchantTotal) * 100}%` }}
                      />
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
                          <span className="flex items-center justify-center size-9 rounded-full bg-secondary text-xs font-semibold tabular-nums text-foreground shrink-0">
                            {m.count}×
                          </span>
                          <span className="text-sm text-foreground truncate">{m.name}</span>
                        </div>
                        <span className="text-sm font-medium tabular-nums text-foreground shrink-0 pl-2 font-mono">
                          {formatCurrency(m.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Category breakdown */}
            <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Category Split
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 flex flex-col gap-3">
                <div className="flex h-3 rounded-full overflow-hidden">
                  {report.byCategory.map((c) => (
                    <div
                      key={c.category}
                      style={{ width: `${c.pct}%`, background: getCategoryColor(c.category) }}
                      title={`${c.category} ${c.pct.toFixed(0)}%`}
                    />
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  {report.byCategory.map((c) => (
                    <div key={c.category} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-foreground">
                        <span className="size-2.5 rounded-full" style={{ background: getCategoryColor(c.category) }} />
                        {c.category}
                        <span className="text-muted-foreground text-xs">{c.pct.toFixed(0)}%</span>
                      </span>
                      <span className="font-medium tabular-nums text-foreground font-mono">
                        {formatCurrency(c.total)}
                      </span>
                    </div>
                  ))}
                </div>
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
                      <span className="text-sm font-medium tabular-nums text-foreground shrink-0 font-mono">
                        {formatCurrency(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: "good" | "bad";
  icon?: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <CardContent className="p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
          {icon}
          {label}
        </p>
        <p
          className={`mt-2 text-xl leading-none font-medium tabular-nums font-mono ${
            trend === "good" ? "text-emerald-600 dark:text-emerald-400" : trend === "bad" ? "text-destructive" : "text-foreground"
          }`}
        >
          {trend === "good" && <TrendingDown size={15} className="inline mr-1 -mt-0.5" />}
          {trend === "bad" && <TrendingUp size={15} className="inline mr-1 -mt-0.5" />}
          {value}
        </p>
        {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
