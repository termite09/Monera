"use client";

import { useState, useMemo, useCallback } from "react";
import type { WeekdayChartMode } from "@/components/charts/WeekdayChart";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ChevronLeft, Upload } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { ErrorState } from "@/components/layout/ErrorState";
import { Header } from "@/components/layout/Header";
import { SummaryCard } from "@/components/budget/SummaryCard";
import { BudgetDonut } from "@/components/budget/BudgetDonut";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { AppTour } from "@/components/onboarding/AppTour";
import { useAppData } from "@/contexts/AppDataContext";
import { useBudget } from "@/hooks/useBudget";
import { getRecurringTransactions } from "@/lib/recurring";
import { computeSafeToSpend } from "@/lib/safeToSpend";
import { getPeriodBounds, formatDate, roundMoney, cn, getMonthKey, toDateStr } from "@/lib/utils";
import { getChartDateRange } from "@/components/charts/WeekdayChart";
import { WEEKDAY_LABELS } from "@/config/constants";
import { detectSubscriptions } from "@/lib/reports";
import { getUpcomingCharges } from "@/lib/upcomingCharges";
import { UpcomingChargesCard } from "@/components/dashboard/UpcomingChargesCard";
import { IncomeSheet } from "./_sheets/IncomeSheet";
import { ExpensesSheet } from "./_sheets/ExpensesSheet";
import { SavingsSheet } from "./_sheets/SavingsSheet";
import { RemainingSheet } from "./_sheets/RemainingSheet";
import { SafeToSpendSheet } from "./_sheets/SafeToSpendSheet";
import { WeekdaySheet } from "./_sheets/WeekdaySheet";

const WeekdayChart = dynamic(
  () => import("@/components/charts/WeekdayChart").then((m) => m.WeekdayChart),
  { ssr: false, loading: () => <Skeleton className="h-40 w-full" /> }
);

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

type SheetKind = "income" | "expenses" | "savings" | "remaining" | "weekday" | "safe";

export default function DashboardPage() {
  const router = useRouter();
  const { month, setMonth, transactions, settings, isLoading, ready, txError, refetch } = useAppData();

  const [weekdayMode, setWeekdayMode] = useState<WeekdayChartMode>("week");
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [weekdayFilter, setWeekdayFilter] = useState<{ label: string; dateStr: string | null } | null>(null);
  // The "Month" tab gets its own month selector, independent of the header period.
  // Month mode is plain calendar-month based (not payday periods), so it defaults
  // to the current calendar month — `getMonthKey(_, 1)` strips any payday offset.
  const [chartMonth, setChartMonth] = useState<string>(() => getMonthKey(new Date(), 1));
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
    // Re-seed the Month picker to the current calendar month each time the tab is
    // chosen, so it always opens on today's month regardless of payday offset.
    if (m === "month") setChartMonth(getMonthKey(new Date(), 1));
    setWeekdayMode(m);
  }, []);

  // Onboarding shows until the user completes the wizard (which persists
  // `onboarded: true`), regardless of whether they uploaded first — so payday,
  // salary, and budget split always get collected. Guarded by `ready` to avoid
  // a flash before settings load.
  const showOnboarding = ready && !settings.onboarded;
  // Onboarded but no data yet → guide the user to import a statement instead of
  // showing zero-value cards. Excludes the load-error case (so the retry banner
  // shows instead) and recurring-only accounts (which do render real budget
  // data). Manual transactions live in `transactions`, so they're counted too.
  const showEmptyState =
    ready && !isLoading && !txError && settings.onboarded &&
    transactions.length === 0 && (settings.recurringPayments?.length ?? 0) === 0;

  const recurringTxs = useMemo(
    () => getRecurringTransactions(settings.recurringPayments ?? [], month, paydayOfMonth, settings.currency ?? "EUR"),
    [settings.recurringPayments, month, paydayOfMonth, settings.currency]
  );
  const allTxs = useMemo(() => [...transactions, ...recurringTxs], [transactions, recurringTxs]);
  const todayStr = useMemo(() => toDateStr(new Date()), []);
  const currentTxs = useMemo(() => allTxs.filter((tx) => tx.date <= todayStr), [allTxs, todayStr]);

  const { summary, budgetAllocations, incomeIsDetected, salaryBasis, additionalIncome } = useBudget(currentTxs, settings, month);
  const safeInfo = useMemo(
    () => computeSafeToSpend(allTxs, settings, month, summary, new Date()),
    [allTxs, settings, month, summary]
  );
  const allSubscriptions = useMemo(() => detectSubscriptions(transactions), [transactions]);
 const recurringBillItems = useMemo(
  () =>
    recurringTxs
      .filter(
        (tx) =>
          !tx.excluded &&
          tx.type === "expense" &&
          tx.date > todayStr
      )
      .map((tx) => ({
        name: tx.description,
        amount: tx.amount,
        date: tx.date,
        source: tx.source,
        category: tx.category,
      })),
  [recurringTxs, todayStr]
);
  const today = useMemo(() => new Date(todayStr + "T00:00:00"), [todayStr]);
  const upcomingCharges = useMemo(
    () =>
      getUpcomingCharges(
        recurringBillItems,
        allSubscriptions.filter(
          (s) => !(settings.excludedSubscriptions ?? []).includes(s.name)
        ),
        today
      ),
    [recurringBillItems, allSubscriptions, settings.excludedSubscriptions, today]
  );
  const salaryKeywords = settings.salaryKeywords ?? [];
  const configuredIncome = settings.monthlyBudgets[month]?.income ?? 0;

  // Period transactions for drill-down sheets
  const periodExpenseTxs = useMemo(() => {
    const { start, end } = getPeriodBounds(month, paydayOfMonth);
    return currentTxs
      .filter((tx) => {
        if (tx.excluded || tx.type !== "expense") return false;
        const d = new Date(tx.date + "T00:00:00");
        return d >= start && d <= end;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [currentTxs, month, paydayOfMonth]);

  const uncategorizedExpense = roundMoney(
    periodExpenseTxs.filter((t) => t.category === "Uncategorized").reduce((s, t) => s + t.amount, 0)
  );

  const periodIncomeTxs = useMemo(() => {
    const { start, end } = getPeriodBounds(month, paydayOfMonth);
    return currentTxs.filter((tx) => {
      if (tx.type !== "income" || tx.excluded) return false;
      const d = new Date(tx.date + "T00:00:00");
      return d >= start && d <= end;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [currentTxs, month, paydayOfMonth]);

  const periodSavingsTxs = useMemo(() => {
    const { start, end } = getPeriodBounds(month, paydayOfMonth);
    return currentTxs.filter((tx) => {
      if (tx.category !== "Savings" || tx.type !== "expense" || tx.excluded) return false;
      const d = new Date(tx.date + "T00:00:00");
      return d >= start && d <= end;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [currentTxs, month, paydayOfMonth]);

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

    // Period / month / year: a single weekday within the visible range only.
    const dayIdx = WEEKDAY_LABELS.indexOf(label);
    if (dayIdx === -1) return [];
    let start: Date, end: Date;
    if (weekdayMode === "month") {
      const [y, m] = chartMonth.split("-").map(Number);
      start = new Date(y, m - 1, 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(y, m, 0);
      end.setHours(23, 59, 59, 999);
    } else if (weekdayMode === "year") {
      const [y] = month.split("-").map(Number);
      start = new Date(y, 0, 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(y, 11, 31);
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

  // The third card is forward-looking when this is the live period (what you can
  // still spend before payday), and falls back to the final "Remaining" once the
  // period is over (or when income is unknown).
  const spendableCard = safeInfo.applicable
    ? {
        label: "Safe to spend",
        amount: safeInfo.safe,
        colorClass: safeInfo.safe >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
        accent: safeInfo.safe >= 0 ? "#10b981" : "#ef4444",
        secondaryText: `${safeInfo.daysLeft} day${safeInfo.daysLeft === 1 ? "" : "s"} to payday`,
        info: "What you can still spend before payday, after setting aside your savings target and recurring bills this period.",
        onClick: () => setSheet("safe"),
      }
    : {
        label: "Remaining",
        amount: summary.remaining,
        colorClass: summary.remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
        accent: summary.remaining >= 0 ? "#10b981" : "#ef4444",
        info: "Income minus total expenses. Positive means you're within budget; negative means you've overspent.",
        onClick: () => setSheet("remaining"),
      };

  const summaryCards = [
    { label: "Income", amount: summary.income, colorClass: "text-emerald-600 dark:text-emerald-400", accent: "#10b981", info: "Your total income this period — planned salary plus any income transactions received.", onClick: () => setSheet("income") },
    { label: "Expenses", amount: summary.totalExpenses - summary.savings, colorClass: "text-foreground", accent: "#64748b", info: "Money spent on Needs and Wants this period. Refunds are already subtracted. Savings are shown separately.", onClick: () => setSheet("expenses") },
    spendableCard,
    { label: "Savings", amount: summary.savings, colorClass: "text-primary", accent: "#1C3557", info: "Money categorised as Savings — savings transfers, insurance, or any recurring Savings bill.", onClick: () => setSheet("savings") },
  ];

  if (showOnboarding) {
    return (
      <PageShell>
        <Onboarding />
      </PageShell>
    );
  }

  if (showEmptyState) {
    return (
      <PageShell>
        <Header month={month} onMonthChange={setMonth} paydayOfMonth={paydayOfMonth} isLoading={isLoading} />
        <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-5">
          <Card className="rounded-2xl border-border/70">
            <CardContent className="py-14 flex flex-col items-center text-center gap-4">
              <Upload size={32} className="text-muted-foreground/50" />
              <div>
                <p className="text-base font-medium text-foreground">No transactions yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  Import a Revolut statement to see your spending, budgets, and insights here.
                </p>
              </div>
              <Button onClick={() => router.push("/upload")}>
                <Upload size={16} className="mr-1.5" />
                Import a statement
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Header month={month} onMonthChange={setMonth} paydayOfMonth={paydayOfMonth} isLoading={isLoading} />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-5">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Today</span>
          {" · "}
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>

        {txError && <ErrorState message={txError} onRetry={refetch} />}

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
        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-foreground">
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

        {/* Upcoming charges */}
        <UpcomingChargesCard
          charges={upcomingCharges}
          currency={settings.currency ?? "€"}
        />

        {/* Weekday spending chart */}
        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-1 pt-4 px-4 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-foreground">Spending by Day</CardTitle>
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
                <ChevronLeft size={15} className="rotate-180" />
              </button>
            </div>
          ) : chartDateRange ? (
            <p className="px-4 text-[11px] text-muted-foreground pb-1">{chartDateRange}</p>
          ) : null}
          <CardContent className="px-4 pb-4">
            <WeekdayChart
              transactions={currentTxs}
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
            <IncomeSheet
              salaryBasis={salaryBasis}
              configuredIncome={configuredIncome}
              periodIncomeTxs={periodIncomeTxs}
              salaryKeywords={salaryKeywords}
              onManage={() => { closeSheet(); router.push("/transactions"); }}
            />
          )}
          {sheet === "expenses" && (
            <ExpensesSheet
              summary={summary}
              uncategorizedExpense={uncategorizedExpense}
              periodExpenseTxs={periodExpenseTxs}
              expandedCat={expandedCat}
              setExpandedCat={setExpandedCat}
            />
          )}
          {sheet === "savings" && (
            <SavingsSheet
              periodSavingsTxs={periodSavingsTxs}
              onSettings={() => { closeSheet(); router.push("/settings?tab=setup"); }}
            />
          )}
          {sheet === "remaining" && (
            <RemainingSheet
              summary={summary}
              salaryBasis={salaryBasis}
              incomeIsDetected={incomeIsDetected}
              configuredIncome={configuredIncome}
              additionalIncome={additionalIncome}
              onReview={() => { closeSheet(); router.push("/transactions"); }}
            />
          )}
          {sheet === "safe" && (
            <SafeToSpendSheet safeInfo={safeInfo} />
          )}
          {sheet === "weekday" && weekdayFilter && (
            <WeekdaySheet
              weekdayTxs={weekdayTxs}
              chartDateRange={chartDateRange}
              title={
                weekdayMode === "week" && weekdayFilter.dateStr
                  ? `${weekdayFilter.label} · ${formatDate(weekdayFilter.dateStr)}`
                  : `${weekdayFilter.label} spending`
              }
            />
          )}
        </SheetContent>
      </Sheet>

      <AppTour pageKey="dashboard" slides={DASHBOARD_SLIDES} />
    </PageShell>
  );
}
