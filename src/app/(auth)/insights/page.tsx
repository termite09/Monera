"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Repeat, Trophy, Receipt, CalendarClock, CreditCard, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, EyeOff } from "lucide-react";
import { InfoIcon } from "@/components/ui/InfoIcon";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppTour } from "@/components/onboarding/AppTour";
import { useAppData } from "@/contexts/AppDataContext";
import { useBudget } from "@/hooks/useBudget";

const YearBar = dynamic(
  () => import("@/components/charts/YearBar").then((m) => m.YearBar),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
);

const REPORTS_SLIDES = [
  {
    title: "Your insights",
    body: "Insights help you understand your money. Overview shows your savings rate, projected spending, and how this period compares to the last.",
  },
  {
    title: "Dig into the detail",
    body: "Merchants shows where your money actually went — tap any to see the transactions. Subscriptions tracks recurring bills, and Year zooms out to the whole year.",
  },
];
import { buildReport, detectSubscriptions, monthlyCategoryTotals } from "@/lib/reports";
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

type ReportTab = "overview" | "merchants" | "subscriptions" | "year";

const REPORT_TABS: { id: ReportTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "merchants", label: "Merchants" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "year", label: "Year" },
];

const isReportTab = (v: string | null): v is ReportTab =>
  v === "overview" || v === "merchants" || v === "subscriptions" || v === "year";

export default function ReportsPage() {
  const { month, setMonth, transactions, settings, isLoading, toggleExclude } = useAppData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<ReportTab>(() => {
    const t = searchParams.get("tab");
    return isReportTab(t) ? t : "overview";
  });
  const [year, setYear] = useState(() => new Date().getFullYear());
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
  const savingsRate = summary.income > 0 ? Math.round((summary.savings / summary.income) * 100) : null;

  // Year tab: recurring bills injected across the whole year so figures match
  // the dashboard/reports, which inject them per period.
  const yearTotals = useMemo(() => {
    const yearTxs = [
      ...transactions,
      ...getRecurringInRange(
        settings.recurringPayments ?? [],
        new Date(year, 0, 1),
        new Date(year, 11, 31),
        paydayOfMonth,
        settings.currency ?? "EUR"
      ),
    ];
    return monthlyCategoryTotals(yearTxs, year, paydayOfMonth);
  }, [transactions, settings.recurringPayments, settings.currency, year, paydayOfMonth]);
  const yearExpenses = yearTotals.reduce((s, m) => s + m.needs + m.wants + m.savings, 0);
  const yearSavings = yearTotals.reduce((s, m) => s + m.savings, 0);
  const yearAllTxs = useMemo(() => [
    ...transactions,
    ...getRecurringInRange(settings.recurringPayments ?? [], new Date(year, 0, 1), new Date(year, 11, 31), paydayOfMonth, settings.currency ?? "EUR"),
  ], [transactions, settings.recurringPayments, settings.currency, year, paydayOfMonth]);

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
          <h1 className="text-xl font-semibold text-foreground">Insights</h1>
        </div>

        {/* Sub-tab switcher — one report view at a time, no endless scroll */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-secondary">
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
                  {/* This period's analytics — figures not shown on the dashboard */}
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                      <CardContent className="p-4">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
                          Savings Rate
                          <InfoIcon side="bottom" content="The share of your income you set aside this period. Aiming for 20% or more is a common goal." />
                        </p>
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
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">
                          Projected
                          <InfoIcon side="bottom" content="If you keep spending at this period's pace, the estimated total by payday." />
                        </p>
                        <p className="mt-2 text-xl leading-none font-medium tabular-nums font-mono text-foreground">
                          {report.daysElapsed < 3 ? "—" : formatCurrency(report.projectedTotal)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{report.daysElapsed < 3 ? "need more data" : "at current pace"}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* vs Last Period — the headline comparison (category by category) */}
                  {report.prevTotal > 0 ? (
                    <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                      <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          vs Last Period
                          <InfoIcon
                            side="bottom"
                            content="Compares how much you spent per category this period vs the one before. Green ↓ = spent less this period (good). Red ↑ = spent more (worth reviewing). The Change column shows the exact difference."
                          />
                        </CardTitle>
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
                                    <span className="flex-1 min-w-0 text-sm text-foreground break-words">{m.name}</span>
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
                                            <p className="text-sm text-foreground break-words">{cleanDescription(tx.description)}</p>
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
                                <span className="text-sm text-foreground break-words min-w-0">{m.name}</span>
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
                              <p className="text-sm text-foreground break-words">{cleanDescription(t.description)}</p>
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
                                  <p className="text-sm text-foreground break-words min-w-0">{p.name}</p>
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
                                  <p className="text-sm text-foreground break-words">{s.name}</p>
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
                                          <p className="text-sm text-foreground break-words">{cleanDescription(tx.description)}</p>
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

            {tab === "year" && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Spending across the year, by payday period.</p>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setYear((y) => y - 1)} className="size-9" aria-label="Previous year">
                      <ChevronLeft size={16} />
                    </Button>
                    <span className="text-sm font-medium text-foreground w-12 text-center tabular-nums">{year}</span>
                    <Button variant="ghost" size="icon" onClick={() => setYear((y) => y + 1)} className="size-9" aria-label="Next year">
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Card className="shadow-none border-border">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total Expenses</p>
                      <p className="text-xl font-medium text-foreground tabular-nums font-mono">{formatCurrency(yearExpenses)}</p>
                    </CardContent>
                  </Card>
                  <Card className="shadow-none border-border">
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total Savings</p>
                      <p className="text-xl font-medium text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">{formatCurrency(yearSavings)}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="shadow-none border-border">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monthly Breakdown</CardTitle>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">Tap a month to view its transactions on the dashboard.</p>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <YearBar
                      transactions={yearAllTxs}
                      year={year}
                      paydayOfMonth={paydayOfMonth}
                      onMonthClick={(key) => { setMonth(key); router.push("/dashboard"); }}
                    />
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
