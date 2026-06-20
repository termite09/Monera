"use client";

import { useState, useMemo } from "react";
import { TrendingDown, TrendingUp, Repeat, Trophy, Receipt, CalendarClock, CreditCard, ArrowRight, ChevronDown, EyeOff } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AppTour } from "@/components/onboarding/AppTour";
import { useAppData } from "@/contexts/AppDataContext";

const REPORTS_SLIDES = [
  {
    title: "Period overview",
    body: "Reports compare this period to the previous one. Green means you spent less; red means more. The three tabs break down spending by different angles.",
  },
  {
    title: "Merchant breakdown",
    body: "The Merchants tab shows where your money actually went. Tap any merchant to expand and see the individual transactions behind the total.",
  },
];
import { useBudget } from "@/hooks/useBudget";
import { buildReport, detectSubscriptions } from "@/lib/reports";
import { getRecurringInRange } from "@/lib/recurring";
import { formatCurrency, formatDate, getCategoryColor, getPeriodBounds, cleanDescription, cn } from "@/lib/utils";
import { Category } from "@/types";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function fmtPeriodKey(key: string): string {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function periodRangeBadge(startMonth?: string, endMonth?: string): string | null {
  if (!startMonth && !endMonth) return null;
  if (startMonth && endMonth) return `${fmtPeriodKey(startMonth)} – ${fmtPeriodKey(endMonth)}`;
  if (startMonth) return `From ${fmtPeriodKey(startMonth)}`;
  return `Until ${fmtPeriodKey(endMonth!)}`;
}

const CAT_CHIP: Record<Category, string> = {
  Needs: "bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300",
  Wants: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300",
  Savings: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300",
  Uncategorized: "bg-secondary text-muted-foreground",
};

type ReportTab = "overview" | "merchants" | "subscriptions";

const REPORT_TABS: { id: ReportTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "merchants", label: "Merchants" },
  { id: "subscriptions", label: "Subscriptions" },
];

export default function ReportsPage() {
  const { month, setMonth, transactions, settings, isLoading, toggleExclude } = useAppData();
  const [tab, setTab] = useState<ReportTab>("overview");
  const [expandedMerchant, setExpandedMerchant] = useState<string | null>(null);
  const [showAllFor, setShowAllFor] = useState<Set<string>>(new Set());
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const paydayOfMonth = settings.paydayOfMonth ?? 1;
  const prevMonthKey = (() => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

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
  const { summary } = useBudget(allTxs, settings, month);

  // Subscriptions span all history, not just the selected period.
  const subscriptions = useMemo(() => detectSubscriptions(transactions), [transactions]);
  const subsMonthly = subscriptions.reduce((s, sub) => s + sub.amount, 0);

  const periodExpenseTxs = useMemo(() => {
    const { start, end } = getPeriodBounds(month, paydayOfMonth);
    return allTxs
      .filter((tx) => {
        if (tx.excluded || tx.type !== "expense") return false;
        const d = new Date(tx.date + "T00:00:00");
        return d >= start && d <= end;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allTxs, month, paydayOfMonth]);

  const allMerchants = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const tx of periodExpenseTxs) {
      const prev = map.get(tx.description) ?? { total: 0, count: 0 };
      map.set(tx.description, { total: prev.total + tx.amount, count: prev.count + 1 });
    }
    return [...map.entries()]
      .map(([name, { total, count }]) => ({ name, total: Math.round(total * 100) / 100, count }))
      .sort((a, b) => b.total - a.total);
  }, [periodExpenseTxs]);

  const maxMerchantTotal = Math.max(1, ...allMerchants.map((m) => m.total));

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
                  {/* Pace & health — report-only metrics the dashboard doesn't show.
                      (Income, Saved, Total Spent live on the dashboard, so they're
                      intentionally not duplicated here.) */}
                  <div className="grid grid-cols-3 gap-3">
                    <StatTile
                      compact
                      label="Avg / Day"
                      value={formatCurrency(report.avgPerDay)}
                      sub={`over ${report.daysElapsed} day${report.daysElapsed === 1 ? "" : "s"}`}
                    />
                    <StatTile
                      compact
                      label="Projected"
                      value={report.daysElapsed < 3 ? "—" : formatCurrency(report.projectedTotal)}
                      sub={report.daysElapsed < 3 ? "need more data" : "at this pace"}
                    />
                    <StatTile
                      compact
                      label="Savings Rate"
                      value={summary.income > 0 ? `${Math.round((summary.savings / summary.income) * 100)}%` : "—"}
                      sub={summary.income > 0 ? (summary.savings / summary.income >= 0.2 ? "on track" : "below 20%") : "set income"}
                      trend={summary.income > 0 && summary.savings / summary.income >= 0.2 ? "good" : undefined}
                    />
                  </div>

                  {/* vs Last Period — the headline comparison (category by category) */}
                  {report.prevTotal > 0 ? (
                    <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">vs Last Period</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fmtPeriodKey(prevMonthKey)} compared to {fmtPeriodKey(month)} — by category.
                        </p>
                      </CardHeader>
                      <CardContent className="px-4 pb-4 flex flex-col gap-0">
                        {/* Column labels */}
                        <div className="flex items-center justify-between pb-1.5 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                          <span />
                          <div className="flex items-center gap-2">
                            <span>Last</span>
                            <span className="opacity-0 pointer-events-none"><ArrowRight size={12} /></span>
                            <span>This period</span>
                            <span className="ml-1 min-w-14 text-right">Change</span>
                          </div>
                        </div>
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
                                <span className={cn("text-xs font-medium ml-1 min-w-14 text-right", better ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
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
              ))}

            {tab === "merchants" &&
              (report.txCount === 0 ? (
                emptyPeriod
              ) : (
                <>
                  {/* Where your money goes — all merchants, expandable */}
                  <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <Trophy size={13} /> Where Your Money Goes
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">Tap any merchant to see the transactions behind it.</p>
                    </CardHeader>
                    <CardContent className="px-0 pb-2">
                      {allMerchants.length === 0 ? (
                        <p className="text-sm text-muted-foreground px-4 py-2">No expense transactions this period.</p>
                      ) : (
                        <div className="overflow-y-auto max-h-[60vh]">
                          {allMerchants.map((m) => {
                            const isOpen = expandedMerchant === m.name;
                            const txs = periodExpenseTxs.filter((tx) => tx.description === m.name);
                            const showAll = showAllFor.has(m.name);
                            const displayTxs = showAll ? txs : txs.slice(0, 20);
                            return (
                              <div key={m.name} className="border-b border-border/50 last:border-0">
                                <button
                                  onClick={() => setExpandedMerchant(isOpen ? null : m.name)}
                                  className="w-full flex flex-col gap-1.5 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="flex-1 min-w-0 text-sm text-foreground wrap-break-word">{m.name}</span>
                                    {m.count > 1 && (
                                      <span className="text-[11px] font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md shrink-0">
                                        {m.count}×
                                      </span>
                                    )}
                                    <span className="text-sm font-medium tabular-nums font-mono text-foreground shrink-0">
                                      {formatCurrency(m.total)}
                                    </span>
                                    <ChevronDown
                                      size={14}
                                      className={cn("text-muted-foreground/50 shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
                                    />
                                  </div>
                                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-primary transition-all duration-500"
                                      style={{ width: `${(m.total / maxMerchantTotal) * 100}%` }}
                                    />
                                  </div>
                                </button>
                                {isOpen && (
                                  <div className="mx-4 mb-3 rounded-xl border border-border overflow-hidden">
                                    <div className="divide-y divide-border">
                                      {displayTxs.map((tx) => (
                                        <div key={tx.id} className="flex items-center gap-2 px-3 py-2.5">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                                            <p className="text-sm text-foreground wrap-break-word">{cleanDescription(tx.description)}</p>
                                          </div>
                                          <span className="text-sm tabular-nums font-mono text-foreground shrink-0 w-20 text-right">
                                            {formatCurrency(tx.amount)}
                                          </span>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); toggleExclude(tx.id); }}
                                            className="shrink-0 flex items-center justify-center min-h-11 min-w-11 -mr-2 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-secondary transition-colors"
                                            aria-label="Exclude from calculations"
                                          >
                                            <EyeOff size={14} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                    {txs.length > 20 && !showAll && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setShowAllFor((prev) => new Set([...prev, m.name])); }}
                                        className="w-full py-2.5 text-xs text-primary font-medium text-center border-t border-border hover:bg-secondary/50 transition-colors"
                                      >
                                        Show all {txs.length} transactions
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Most frequent merchants */}
                  <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <Repeat size={13} /> Most Recurring
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">Merchants you pay repeatedly — likely subscriptions or habits worth reviewing.</p>
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
                                <span className="text-sm text-foreground wrap-break-word min-w-0">{m.name}</span>
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
                      <p className="text-xs text-muted-foreground mt-0.5">Your largest individual transactions this period.</p>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="flex flex-col divide-y divide-border">
                        {report.biggest.map((t) => (
                          <div key={t.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                            <div className="min-w-0 pr-2">
                              <p className="text-sm text-foreground wrap-break-word">{cleanDescription(t.description)}</p>
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
              <>
                {/* Configured recurring bills */}
                <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <CardHeader className="pb-2 pt-4 px-4 flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <CalendarClock size={13} /> Configured Recurring Bills
                    </CardTitle>
                    {(settings.recurringPayments ?? []).length > 0 && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatCurrency((settings.recurringPayments ?? []).reduce((s, p) => s + p.amount, 0))}/mo
                      </span>
                    )}
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {(settings.recurringPayments ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No recurring bills configured. Add them in Settings → Recurring.</p>
                    ) : (
                      <div className="flex flex-col divide-y divide-border">
                        {(settings.recurringPayments ?? []).map((p) => {
                          const badge = periodRangeBadge(p.startMonth, p.endMonth);
                          return (
                            <div key={p.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm text-foreground wrap-break-word min-w-0">{p.name}</p>
                                  <span className={cn("text-[11px] font-medium px-1.5 py-0.5 rounded-md shrink-0", CAT_CHIP[p.category])}>
                                    {p.category}
                                  </span>
                                  {badge && (
                                    <span className="text-[11px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md shrink-0">
                                      {badge}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{ordinal(p.dayOfMonth)} of the month</p>
                              </div>
                              <span className="text-sm font-medium tabular-nums text-foreground shrink-0 font-mono">{formatCurrency(p.amount)}/mo</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Auto-detected subscriptions */}
                <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <CardHeader className="pb-2 pt-4 px-4 flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <CreditCard size={13} /> Auto-Detected Subscriptions
                    </CardTitle>
                    {subscriptions.length > 0 && <span className="text-xs text-muted-foreground tabular-nums">~{formatCurrency(subsMonthly)}/mo</span>}
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    {subscriptions.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No recurring subscriptions detected yet.</p>
                    ) : (
                      <div className="flex flex-col divide-y divide-border -mx-4">
                        {subscriptions.map((s) => {
                          const isOpen = expandedSub === s.name;
                          const subTxs = isOpen
                            ? transactions
                                .filter((t) => !t.excluded && t.type === "expense" && t.description.toLowerCase().includes(s.name.toLowerCase().trim()))
                                .sort((a, b) => b.date.localeCompare(a.date))
                            : [];
                          return (
                            <div key={s.name} className="border-b border-border/50 last:border-0">
                              <button
                                onClick={() => setExpandedSub(isOpen ? null : s.name)}
                                className="w-full flex items-center gap-2 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-foreground wrap-break-word">{s.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {s.months} month{s.months === 1 ? "" : "s"} · last {formatDate(s.lastDate)}
                                  </p>
                                </div>
                                <span className="text-sm font-medium tabular-nums text-foreground shrink-0 font-mono">{formatCurrency(s.amount)}</span>
                                <ChevronDown
                                  size={14}
                                  className={cn("text-muted-foreground/50 shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
                                />
                              </button>
                              {isOpen && (
                                <div className="mx-4 mb-3 rounded-xl border border-border overflow-hidden">
                                  <p className="px-3 py-2 text-[11px] text-muted-foreground bg-secondary/50 border-b border-border">
                                    {subTxs.length} charge{subTxs.length === 1 ? "" : "s"} across all history
                                  </p>
                                  <div className="divide-y divide-border">
                                    {subTxs.length === 0 ? (
                                      <p className="text-sm text-muted-foreground px-3 py-3">No transactions found.</p>
                                    ) : subTxs.map((tx) => (
                                      <div key={tx.id} className="flex items-start gap-3 px-3 py-2.5">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm text-foreground wrap-break-word">{cleanDescription(tx.description)}</p>
                                          <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                                        </div>
                                        <span className="text-sm tabular-nums font-mono text-foreground shrink-0 w-20 text-right">{formatCurrency(tx.amount)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>

      <AppTour pageKey="reports" slides={REPORTS_SLIDES} />
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
  purpose,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: "good" | "bad";
  icon?: React.ReactNode;
  compact?: boolean;
  purpose?: string;
}) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] min-w-0">
      <CardContent className={compact ? "p-3" : "p-4"}>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] truncate">
          {icon}
          {label}
        </p>
        {purpose && <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-tight">{purpose}</p>}
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
