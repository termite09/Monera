"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { WeekdayChartMode } from "@/components/charts/WeekdayChart";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AlertCircle, RefreshCw, ChevronRight, ChevronLeft } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { SummaryCard } from "@/components/budget/SummaryCard";
import { BudgetDonut } from "@/components/budget/BudgetDonut";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const WeekdayChart = dynamic(
  () => import("@/components/charts/WeekdayChart").then((m) => m.WeekdayChart),
  { ssr: false, loading: () => <Skeleton className="h-40 w-full" /> }
);

import { Onboarding } from "@/components/onboarding/Onboarding";
import { AppTour } from "@/components/onboarding/AppTour";
import { useAppData } from "@/contexts/AppDataContext";
import { useBudget } from "@/hooks/useBudget";
import { getRecurringTransactions } from "@/lib/recurring";
import { getPeriodBounds, formatCurrency, formatDate, roundMoney, cleanDescription, cn } from "@/lib/utils";
import { getChartDateRange } from "@/components/charts/WeekdayChart";
import { WEEKDAY_LABELS } from "@/config/constants";

const DASHBOARD_SLIDES = [
  {
    title: "Your financial snapshot",
    body: "The four cards show your income, spending, what's left, and savings for this period. Tap any card to see the transactions behind it.",
  },
  {
    title: "Budget circles",
    body: "Each circle shows how much of your budget you've used for Needs, Wants, and Savings. Tap a circle to drill into the transactions behind it.",
  },
  {
    title: "Spending by weekday",
    body: "The chart shows which days you spend most. Switch between Week, Month, Period, and Year to compare different time ranges. Tap a bar to see that day's transactions.",
  },
];

type SheetKind = "income" | "expenses" | "savings" | "remaining" | "weekday";

export default function DashboardPage() {
  const router = useRouter();
  const { month, setMonth, transactions, settings, isLoading, ready, txError, refetch } = useAppData();

  const [weekdayMode, setWeekdayMode] = useState<WeekdayChartMode>("week");
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [weekdayFilter, setWeekdayFilter] = useState<{ label: string; dateStr: string | null } | null>(null);
  // The "Month" tab gets its own month selector, independent of the header period.
  const [chartMonth, setChartMonth] = useState<string>(month);
  const paydayOfMonth = settings.paydayOfMonth ?? 1;

  // In Month mode the chart follows its own picker; every other mode follows the
  // dashboard's selected period.
  const chartKey = weekdayMode === "month" ? chartMonth : month;

  // Pure-derived from the chart mode/period — no state or effect needed.
  const chartDateRange = getChartDateRange(weekdayMode, chartKey, paydayOfMonth);

  const stepChartMonth = useCallback((delta: number) => {
    setChartMonth((prev) => {
      const [y, m] = prev.split("-").map(Number);
      const d = new Date(y, m - 1 + delta, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
  }, []);

  const selectWeekdayMode = useCallback((m: WeekdayChartMode) => {
    // Re-seed the Month picker to the current period each time the tab is chosen,
    // so it always opens on a sensible month.
    if (m === "month") setChartMonth(month);
    setWeekdayMode(m);
  }, [month]);

  const [wasNewAtLoad, setWasNewAtLoad] = useState<boolean | null>(null);
  useEffect(() => {
    if (wasNewAtLoad !== null || !ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWasNewAtLoad(!settings.onboarded && transactions.length === 0);
  }, [wasNewAtLoad, ready, settings.onboarded, transactions.length]);
  const showOnboarding = !settings.onboarded && wasNewAtLoad === true;

  const recurringTxs = useMemo(
    () => getRecurringTransactions(settings.recurringPayments ?? [], month, paydayOfMonth, settings.currency ?? "EUR"),
    [settings.recurringPayments, month, paydayOfMonth, settings.currency]
  );
  const allTxs = useMemo(() => [...transactions, ...recurringTxs], [transactions, recurringTxs]);

  const { summary, budgetAllocations, incomeIsDetected, salaryBasis, additionalIncome } = useBudget(allTxs, settings, month);
  const uncategorizedExpense = roundMoney(summary.totalExpenses - summary.needs - summary.wants - summary.savings);
  const salaryKeywords = settings.salaryKeywords ?? [];
  const configuredIncome = settings.monthlyBudgets[month]?.income ?? 0;

  // Period transactions for drill-down sheets
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

  const periodIncomeTxs = useMemo(() => {
    const { start, end } = getPeriodBounds(month, paydayOfMonth);
    return allTxs.filter((tx) => {
      if (tx.type !== "income" || tx.excluded) return false;
      const d = new Date(tx.date + "T00:00:00");
      return d >= start && d <= end;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [allTxs, month, paydayOfMonth]);

  const periodSavingsTxs = useMemo(() => {
    const { start, end } = getPeriodBounds(month, paydayOfMonth);
    return allTxs.filter((tx) => {
      if (tx.category !== "Savings" || tx.type !== "expense" || tx.excluded) return false;
      const d = new Date(tx.date + "T00:00:00");
      return d >= start && d <= end;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [allTxs, month, paydayOfMonth]);

  const handleDayClick = useCallback((label: string, dateStr: string | null) => {
    setWeekdayFilter({ label, dateStr });
    setSheet("weekday");
  }, []);

  const closeSheet = useCallback(() => {
    setSheet(null);
    setExpandedCat(null);
    setWeekdayFilter(null);
  }, []);

  // Weekday drill-down transactions. Every branch is bounded to the same date
  // range the tapped bar represents, so the sheet's contents always reconcile
  // with the bar — never the user's entire history.
  const weekdayTxs = useMemo(() => {
    if (!weekdayFilter) return [];
    const { label, dateStr } = weekdayFilter;

    // Week mode: one exact calendar date.
    if (weekdayMode === "week" && dateStr && dateStr.length === 10) {
      return allTxs
        .filter((t) => !t.excluded && t.date === dateStr)
        .sort((a, b) => b.date.localeCompare(a.date));
    }

    // Year mode: a full payday period (dateStr is its monthKey, e.g. "2025-06").
    if (weekdayMode === "year" && dateStr) {
      const { start, end } = getPeriodBounds(dateStr, paydayOfMonth);
      return allTxs
        .filter((t) => {
          if (t.excluded || t.type !== "expense") return false;
          const d = new Date(t.date + "T00:00:00");
          return d >= start && d <= end;
        })
        .sort((a, b) => b.date.localeCompare(a.date));
    }

    // Period / month: a single weekday within the visible range only.
    const dayIdx = WEEKDAY_LABELS.indexOf(label);
    if (dayIdx === -1) return [];
    let start: Date, end: Date;
    if (weekdayMode === "month") {
      const [y, m] = chartMonth.split("-").map(Number);
      start = new Date(y, m - 1, 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(y, m, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      ({ start, end } = getPeriodBounds(month, paydayOfMonth));
    }
    return allTxs
      .filter((t) => {
        if (t.excluded) return false;
        const d = new Date(t.date + "T00:00:00");
        if (d < start || d > end) return false;
        return (d.getDay() + 6) % 7 === dayIdx;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [weekdayFilter, weekdayMode, allTxs, month, chartMonth, paydayOfMonth]);

  const summaryCards = [
    { label: "Income", amount: summary.income, icon: "↑", colorClass: "text-emerald-600 dark:text-emerald-400", accent: "#10b981", info: "Your total income this period — planned salary plus any income transactions received.", onClick: () => setSheet("income") },
    { label: "Expenses", amount: summary.totalExpenses - summary.savings, icon: "↓", colorClass: "text-foreground", accent: "#64748b", info: "Money spent on Needs, Wants, and any uncategorised transactions this period. Refunds are already subtracted. Savings are shown separately.", onClick: () => setSheet("expenses") },
    { label: "Remaining", amount: summary.remaining, icon: "=", colorClass: summary.remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive", accent: summary.remaining >= 0 ? "#10b981" : "#ef4444", info: "Income minus total expenses. Positive means you're within budget; negative means you've overspent.", onClick: () => setSheet("remaining") },
    { label: "Savings", amount: summary.savings, icon: "S", colorClass: "text-primary", accent: "#1C3557", info: "Money categorised as Savings — savings transfers, insurance, or any recurring Savings bill.", onClick: () => setSheet("savings") },
  ];

  if (showOnboarding) {
    return (
      <PageShell>
        <Onboarding />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Header month={month} onMonthChange={setMonth} paydayOfMonth={paydayOfMonth} isLoading={isLoading} />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-5">
        {txError && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
            <AlertCircle size={16} className="shrink-0 text-destructive" />
            <p className="flex-1 text-sm text-destructive">{txError}</p>
            <button onClick={refetch} className="flex items-center gap-1 text-xs text-destructive underline-offset-2 hover:underline">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card rounded-2xl border border-border/70 p-4 h-27">
                  <Skeleton className="h-3 w-16 mb-3" />
                  <Skeleton className="h-7 w-24 mb-2" />
                </div>
              ))
            : summaryCards.map((card, i) => (
                <SummaryCard key={card.label} {...card} index={i} />
              ))}
        </div>

        {/* Budget donuts */}
        <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Budget Progress
            </CardTitle>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">Tap a circle to see the transactions behind it.</p>
          </CardHeader>
          <CardContent className="px-4 pb-5">
            <div className="grid grid-cols-3 gap-3">
              <BudgetDonut
                label="Needs"
                spent={summary.needs}
                allocated={budgetAllocations.needs}
                color="#1C3557"
                labelClass="text-primary"
                info="Essential expenses — rent, groceries, utilities, transport. Aim to stay under your Needs budget."
                onClick={() => { setSheet("expenses"); setExpandedCat("Needs"); }}
              />
              <BudgetDonut
                label="Wants"
                spent={summary.wants}
                allocated={budgetAllocations.wants}
                color="#d97706"
                labelClass="text-amber-600 dark:text-amber-400"
                info="Discretionary spending — dining, entertainment, shopping. Your Wants budget is your spending allowance."
                onClick={() => { setSheet("expenses"); setExpandedCat("Wants"); }}
              />
              <BudgetDonut
                label="Savings"
                spent={summary.savings}
                allocated={budgetAllocations.savings}
                color="#10b981"
                labelClass="text-emerald-600 dark:text-emerald-400"
                info="Money set aside for the future — savings transfers, insurance, or any bill marked as Savings."
                onClick={() => setSheet("savings")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Weekday spending chart */}
        <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <CardHeader className="pb-1 pt-4 px-4 flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Spending by Day</CardTitle>
            <div className="flex gap-0.5 p-0.5 rounded-md bg-secondary">
              {(["week", "month", "period", "year"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => selectWeekdayMode(m)}
                  className={cn(
                    "px-2.5 py-1 rounded text-[11px] font-medium transition-colors capitalize",
                    weekdayMode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </CardHeader>
          {weekdayMode === "month" ? (
            <div className="px-4 pb-1 flex items-center gap-1">
              <button
                onClick={() => stepChartMonth(-1)}
                className="flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-[11px] font-medium text-foreground tabular-nums w-28 text-center">{chartDateRange}</span>
              <button
                onClick={() => stepChartMonth(1)}
                className="flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label="Next month"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          ) : chartDateRange ? (
            <p className="px-4 text-[11px] text-muted-foreground pb-1">{chartDateRange}</p>
          ) : null}
          <CardContent className="px-4 pb-4">
            <WeekdayChart
              transactions={allTxs}
              monthKey={chartKey}
              paydayOfMonth={paydayOfMonth}
              mode={weekdayMode}
              onDayClick={handleDayClick}
            />
          </CardContent>
        </Card>

      </div>

      {/* Drill-down sheet */}
      <Sheet open={sheet !== null} onOpenChange={closeSheet}>
        <SheetContent side="bottom" className="max-h-[60vh] flex flex-col overflow-hidden pt-3 pb-4 px-4">
          {sheet === "income" && (
            <>
              <SheetHeader className="shrink-0 mb-1">
                <SheetTitle>Income this period</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto min-h-0">
                {salaryBasis > 0 && (
                  <div className="flex items-center gap-3 py-3 border-b border-border mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {configuredIncome > 0 ? "Planned income (this period)" : "Planned monthly income"}
                      </p>
                      <p className="text-xs text-muted-foreground">Set in Settings → Setup</p>
                    </div>
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 tabular-nums font-mono shrink-0">
                      +{formatCurrency(salaryBasis)}
                    </span>
                  </div>
                )}
                {periodIncomeTxs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No additional income transactions this period.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {periodIncomeTxs.map((tx) => {
                      const isSalary = salaryKeywords.length > 0 &&
                        salaryKeywords.some((k) => tx.description.toLowerCase().includes(k.toLowerCase()));
                      return (
                        <div key={tx.id} className="flex items-center gap-3 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground wrap-break-word">{cleanDescription(tx.description)}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
                              {isSalary && (
                                <span className="text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                                  Salary
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 tabular-nums font-mono shrink-0">
                            +{formatCurrency(tx.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="shrink-0 mt-4 pt-3 border-t border-border flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">Excluded transactions don&apos;t appear here.</p>
                <button
                  onClick={() => { closeSheet(); router.push("/transactions"); }}
                  className="text-left text-xs text-primary hover:underline"
                >
                  Manage transactions →
                </button>
              </div>
            </>
          )}

          {sheet === "expenses" && (
            <>
              <SheetHeader className="shrink-0 mb-1">
                <SheetTitle>Expenses this period</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-1 pb-2">
                {[
                  { label: "Needs", amount: summary.needs, dot: "bg-blue-500", key: "Needs" as const },
                  { label: "Wants", amount: summary.wants, dot: "bg-amber-500", key: "Wants" as const },
                  ...(uncategorizedExpense > 0
                    ? [{ label: "Uncategorized", amount: uncategorizedExpense, dot: "bg-muted-foreground/40", key: "Uncategorized" as const }]
                    : []),
                ].map((cat) => {
                  const isOpen = expandedCat === cat.key;
                  const catTxs = periodExpenseTxs.filter((tx) => tx.category === cat.key);
                  return (
                    <div key={cat.key}>
                      <button
                        onClick={() => setExpandedCat(isOpen ? null : cat.key)}
                        className="flex items-center gap-3 px-3 py-3.5 rounded-xl hover:bg-secondary transition-colors text-left w-full"
                      >
                        <span className={cn("size-2.5 rounded-full shrink-0", cat.dot)} />
                        <span className="flex-1 text-sm font-medium">{cat.label}</span>
                        <span className="text-sm tabular-nums font-mono text-foreground mr-1">{formatCurrency(cat.amount)}</span>
                        <ChevronRight size={14} className={cn("text-muted-foreground/50 shrink-0 transition-transform duration-200", isOpen && "rotate-90")} />
                      </button>
                      {isOpen && (
                        <div className="mx-3 mb-2 rounded-xl border border-border overflow-hidden">
                          {catTxs.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-3 px-4">No transactions</p>
                          ) : (
                            <div className="divide-y divide-border">
                              {catTxs.map((tx) => (
                                <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-foreground wrap-break-word">{cleanDescription(tx.description)}</p>
                                    <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                                  </div>
                                  <span className="text-sm tabular-nums font-mono text-foreground shrink-0">
                                    {formatCurrency(tx.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="shrink-0 text-xs text-muted-foreground pt-3 border-t border-border">
                Tap a category to expand its transactions. Savings are shown separately.
              </p>
            </>
          )}

          {sheet === "savings" && (
            <>
              <SheetHeader className="shrink-0 mb-1">
                <SheetTitle>Savings this period</SheetTitle>
              </SheetHeader>
              <p className="shrink-0 text-sm text-muted-foreground mb-4">
                This total includes transactions categorised as Savings — savings account transfers, insurance premiums, or any recurring bill marked Savings. It&apos;s real money you set aside, not a target.
              </p>
              <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-border">
                {periodSavingsTxs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No savings transactions this period.</p>
                ) : periodSavingsTxs.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground wrap-break-word">{cleanDescription(tx.description)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                    </div>
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 tabular-nums font-mono shrink-0">
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { closeSheet(); router.push("/settings"); }}
                className="shrink-0 mt-4 pt-3 border-t border-border text-left text-xs text-primary hover:underline"
              >
                Change your Savings budget in Settings →
              </button>
            </>
          )}

          {sheet === "remaining" && (
            <>
              <SheetHeader className="shrink-0 mb-1">
                <SheetTitle>Remaining budget</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4">
                <div className="bg-secondary/50 rounded-xl px-4 py-4 flex flex-col gap-3 font-mono text-sm">
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
                  <div className="border-t border-border pt-3 flex items-center justify-between font-semibold">
                    <span>Remaining</span>
                    <span className={summary.remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                      {formatCurrency(summary.remaining)}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Remaining = income minus all spending (Needs, Wants, Savings, and any Uncategorised transactions) for this period.{" "}
                  {summary.remaining >= 0 ? "You're within budget." : "You've overspent this period."}
                </p>
                <button
                  onClick={() => { closeSheet(); router.push("/transactions"); }}
                  className="text-left text-xs text-primary hover:underline"
                >
                  Review all transactions →
                </button>
              </div>
            </>
          )}

          {sheet === "weekday" && weekdayFilter && (
            <>
              <SheetHeader className="shrink-0 mb-1">
                <SheetTitle>
                  {weekdayMode === "week" && weekdayFilter.dateStr && weekdayFilter.dateStr.length === 10
                    ? `${weekdayFilter.label} · ${formatDate(weekdayFilter.dateStr)}`
                    : weekdayMode === "year" && weekdayFilter.dateStr
                    ? (() => {
                        const [y, m] = weekdayFilter.dateStr.split("-").map(Number);
                        return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
                      })()
                    : `${weekdayFilter.label} spending`}
                </SheetTitle>
              </SheetHeader>
              <p className="shrink-0 text-xs text-muted-foreground mb-3">{chartDateRange}</p>
              <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-border">
                {weekdayTxs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No transactions for this selection.</p>
                ) : weekdayTxs.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground wrap-break-word">{cleanDescription(tx.description)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                    </div>
                    <span className={cn(
                      "text-sm tabular-nums font-mono shrink-0",
                      tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                    )}>
                      {tx.type === "income" ? "+" : "−"}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AppTour pageKey="dashboard" slides={DASHBOARD_SLIDES} />
    </PageShell>
  );
}
