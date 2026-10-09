"use client";

import { useState, useMemo, useCallback } from "react";
import type { WeekdayChartMode } from "@/components/charts/WeekdayChart";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Upload, AlertTriangle, CheckCircle2, Info, ChevronLeft, ChevronRight } from "lucide-react";
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
import { computeSafeToSpend, dailyAllowance, nextPayday } from "@/lib/safeToSpend";
import { buildInsights, type InsightTone } from "@/lib/insights";
import { getPeriodBounds, formatDate, formatShortDate, formatCurrency, roundMoney, cn, toDateStr, getCurrentMonth, getPrevMonthKey, getMonthKey, cleanDescription } from "@/lib/utils";
import { getChartDateRange, buildWeekdayData, fullDayName } from "@/components/charts/WeekdayChart";
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
    title: "What you can spend",
    body: "Safe to spend is what's left before payday once your bills and savings target are set aside. Tap it to see how it's worked out.",
  },
  {
    title: "Your budget at a glance",
    body: "The circles show what's left in Needs, Wants and Savings this pay period. Tap one to see the transactions behind it.",
  },
  {
    title: "When you spend",
    body: "The chart shows which days of the week cost you most. Tap a day to see what you bought.",
  },
];

const CHART_MODES: { value: WeekdayChartMode; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "period", label: "Period" },
  { value: "year", label: "Year" },
];

const INSIGHT_ICON: Record<InsightTone, { Icon: typeof Info; cls: string; label: string }> = {
  warn: { Icon: AlertTriangle, cls: "text-status-warn", label: "Heads up" },
  good: { Icon: CheckCircle2, cls: "text-status-ok", label: "Good news" },
  info: { Icon: Info, cls: "text-muted-foreground", label: "Note" },
};

const longDate = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

type SheetKind = "income" | "expenses" | "savings" | "remaining" | "weekday" | "safe";

export default function DashboardPage() {
  const router = useRouter();
  const { month, setMonth, transactions, settings, isLoading, ready, txError, refetch, updateSettings } = useAppData();

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

  const {
    summary, budgetAllocations, salaryBasis, additionalIncome,
    salaryUsed, salaryFromStatement, salaryTxIds, unconfirmedSalaryTx,
  } = useBudget(currentTxs, settings, month);
  const safeInfo = useMemo(
    () => computeSafeToSpend(allTxs, settings, month, summary, new Date(), budgetAllocations.savings),
    [allTxs, settings, month, summary, budgetAllocations.savings]
  );

  // How current the numbers are: the newest transaction from an imported statement.
  const latestImported = useMemo(
    () => transactions.reduce<string | null>((latest, t) => (t.source === "revolut" && (!latest || t.date > latest) ? t.date : latest), null),
    [transactions]
  );
  const periodStartStr = toDateStr(getPeriodBounds(month, paydayOfMonth).start);
  const periodHasStatement = latestImported !== null && latestImported >= periodStartStr;

  // "Is this your pay?" — confirming saves a salary keyword so the deposit is
  // recognised every period; dismissing hides it for this visit.
  const [salaryPromptDismissed, setSalaryPromptDismissed] = useState(false);
  const confirmSalary = useCallback(async () => {
    if (!unconfirmedSalaryTx) return;
    const keyword = cleanDescription(unconfirmedSalaryTx.description).toLowerCase();
    await updateSettings({ ...settings, salaryKeywords: [...(settings.salaryKeywords ?? []), keyword] });
  }, [unconfirmedSalaryTx, settings, updateSettings]);
  // Two plain-language lines, warnings first. Last period's recurring bills are
  // included so "vs last period" compares like with like.
  const insights = useMemo(() => {
    const prevRecurring = getRecurringTransactions(settings.recurringPayments ?? [], getPrevMonthKey(month), paydayOfMonth, settings.currency ?? "EUR");
    return buildInsights([...currentTxs, ...prevRecurring], settings, month, summary, budgetAllocations, new Date()).slice(0, 2);
  }, [currentTxs, settings, month, paydayOfMonth, summary, budgetAllocations]);
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
      return currentTxs
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
    return currentTxs
      .filter((t) => {
        if (t.excluded) return false;
        const d = new Date(t.date + "T00:00:00");
        if (d < start || d > end) return false;
        return (d.getDay() + 6) % 7 === dayIdx;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [weekdayFilter, weekdayMode, currentTxs, month, chartMonth, paydayOfMonth]);

  // Where the selected period sits relative to today, for the date line and the
  // fallback copy when "safe to spend" doesn't apply.
  const currentKey = getCurrentMonth(paydayOfMonth);
  const periodTiming = month === currentKey ? "current" : month < currentKey ? "past" : "future";
  const payday = nextPayday(month, paydayOfMonth);
  const paydayLabel = longDate(payday);
  const money = (n: number) => <span className="font-mono tabular-nums font-medium text-foreground">{formatCurrency(n)}</span>;

  // The one tile that answers "can I spend?": forward-looking in the live period,
  // the final "Remaining" otherwise.
  const allowance = safeInfo.applicable ? dailyAllowance(safeInfo.safe, safeInfo.daysLeft) : null;
  const freshness = latestImported ? <>Based on your statement up to {formatShortDate(latestImported)}.</> : null;
  const heroCard = periodTiming === "current" && !periodHasStatement
    ? {
        // No statement covers this period yet — a confident number would be a guess.
        label: "Safe to spend",
        amount: null,
        negative: false,
        sentence: <>Add this pay period&apos;s statement to see what&apos;s safe to spend before payday on {paydayLabel}.</>,
        note: latestImported ? <>Your latest statement ends {formatShortDate(latestImported)}.</> : null,
        onClick: () => router.push("/upload"),
      }
    : safeInfo.applicable
    ? {
        label: "Safe to spend",
        amount: safeInfo.safe,
        negative: safeInfo.safe < 0,
        sentence:
          safeInfo.safe < 0 ? <>You&apos;ve spent {money(-safeInfo.safe)} more than is safe before payday on {paydayLabel}.</>
          : allowance !== null && safeInfo.daysLeft > 1 ? <>About {money(allowance)} a day for the next {safeInfo.daysLeft} days, until payday on {paydayLabel}.</>
          : allowance !== null ? <>Payday is tomorrow, {paydayLabel}.</>
          : <>Nothing left to spend safely before payday on {paydayLabel}.</>,
        note: freshness,
        onClick: () => setSheet("safe" as const),
      }
    : {
        label: "Remaining",
        amount: summary.remaining,
        negative: summary.remaining < 0,
        sentence:
          safeInfo.reason === "no-income" ? <>Add your pay in Settings to see what&apos;s safe to spend before payday.</>
          : periodTiming === "future" ? <>This pay period hasn&apos;t started yet.</>
          : summary.remaining >= 0 ? <>Left over from this pay period.</>
          : <>You spent more than came in this pay period.</>,
        note: periodTiming === "current" ? freshness : null,
        onClick: () => setSheet("remaining" as const),
      };

  const summaryCards = [
    { label: "Income", amount: summary.income, sign: "+", onClick: () => setSheet("income") },
    { label: "Spent", amount: summary.totalExpenses - summary.savings, onClick: () => setSheet("expenses") },
    { label: "Saved", amount: summary.savings, onClick: () => setSheet("savings") },
  ];

  // One-line takeaway so the chart reads without an axis.
  const chartPeak = buildWeekdayData(currentTxs, weekdayMode, chartKey, paydayOfMonth).find((d) => d.isMax);
  const chartScope =
    weekdayMode === "month" ? `in ${chartDateRange.split(" ")[0]}`
    : weekdayMode === "year" ? "this year"
    : "this period";
  const chartTakeaway = !chartPeak ? null
    : weekdayMode === "week" ? <>Most spent this week: {fullDayName(chartPeak.day)}, {money(chartPeak.amount)}.</>
    : <>{fullDayName(chartPeak.day)}s cost you the most {chartScope}: {money(chartPeak.amount)}.</>;

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
        <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-5 md:max-w-none md:px-6">
          <Card>
            <CardContent className="py-14 flex flex-col items-center text-center gap-4">
              <Upload size={32} className="text-muted-foreground" aria-hidden />
              <div>
                <h1 className="text-base font-medium text-foreground">No transactions yet</h1>
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

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-3 pt-4 md:max-w-none md:px-6 md:pt-3 md:pb-0">
        <h1 className="text-base font-normal text-muted-foreground">
          {periodTiming === "current" ? (
            <><span className="font-semibold text-foreground">Today</span> · {longDate(new Date())}</>
          ) : periodTiming === "past" ? (
            <><span className="font-semibold text-foreground">Past pay period</span> · ended {longDate(new Date(payday.getTime() - 86400000))}</>
          ) : (
            <><span className="font-semibold text-foreground">Upcoming pay period</span> · starts {longDate(getPeriodBounds(month, paydayOfMonth).start)}</>
          )}
        </h1>

        {txError && <ErrorState message={txError} onRetry={refetch} />}

        {/* Summary: the answer first, then the three figures behind it */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-5">
          {isLoading ? (
            <>
              <div className="col-span-3 md:col-span-2 bg-card rounded-xl border border-border p-5 h-36">
                <Skeleton className="h-3.5 w-24 mb-3" />
                <Skeleton className="h-9 w-36 mb-3" />
                <Skeleton className="h-3.5 w-full max-w-72" />
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-card rounded-xl border border-border p-4 h-24">
                  <Skeleton className="h-3 w-14 mb-3" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </>
          ) : (
            <>
              <SummaryCard {...heroCard} variant="hero" index={0} className="col-span-3 md:col-span-2" />
              {summaryCards.map((card, i) => (
                <SummaryCard key={card.label} {...card} index={i + 1} />
              ))}
            </>
          )}
        </div>

        {/* Pay confirmation — the deposit we took to be pay, until it's confirmed */}
        {!isLoading && unconfirmedSalaryTx && !salaryPromptDismissed && (
          <section aria-labelledby="pay-heading" className="rounded-xl border border-primary/30 bg-primary/3 px-4 py-4 md:px-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 min-w-0">
              <h2 id="pay-heading" className="text-sm font-semibold text-foreground">Is this your pay?</h2>
              <p className="text-sm text-foreground/80 mt-0.5">
                We found {money(unconfirmedSalaryTx.amount)} from {cleanDescription(unconfirmedSalaryTx.description)} on {formatShortDate(unconfirmedSalaryTx.date)}, and we&apos;re counting it as your pay instead of the amount you entered.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={confirmSalary}>Yes, that&apos;s my pay</Button>
              <Button size="sm" variant="outline" onClick={() => { setSalaryPromptDismissed(true); router.push("/settings?tab=sources"); }}>
                No
              </Button>
            </div>
          </section>
        )}

        {/* Plain-language takeaways */}
        {!isLoading && periodHasStatement && insights.length > 0 && (
          <section aria-labelledby="insights-heading" className="rounded-xl border border-border bg-card px-4 py-4 md:px-6">
            <h2 id="insights-heading" className="text-sm font-semibold text-foreground mb-2.5">
              {periodTiming === "current" ? "So far this period" : "This pay period"}
            </h2>
            <ul className="flex flex-col gap-2.5">
              {insights.map((ins) => {
                const { Icon, cls, label } = INSIGHT_ICON[ins.tone];
                return (
                  <li key={ins.id} className="flex items-start gap-2.5 text-base leading-relaxed text-foreground">
                    <Icon size={16} className={cn("mt-1 shrink-0", cls)} aria-label={label} role="img" />
                    <span>{ins.text}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Budget progress */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4 md:px-6">
            <CardTitle className="text-sm font-semibold text-foreground">
              <h2>Budget progress</h2>
            </CardTitle>
            <p className="text-sm text-muted-foreground">Select a category to see its transactions.</p>
          </CardHeader>
          <CardContent className="px-4 pb-5 md:px-6">
            <div className="grid grid-cols-3 gap-3 mt-2 md:max-w-2xl md:mx-auto">
              <BudgetDonut
                category="Needs"
                spent={summary.needs}
                allocated={budgetAllocations.needs}
                info="Essential spending — rent, groceries, bills, transport."
                onClick={() => { setSheet("expenses"); setExpandedCat("Needs"); }}
              />
              <BudgetDonut
                category="Wants"
                spent={summary.wants}
                allocated={budgetAllocations.wants}
                info="Everything optional — eating out, shopping, subscriptions."
                onClick={() => { setSheet("expenses"); setExpandedCat("Wants"); }}
              />
              <BudgetDonut
                category="Savings"
                spent={summary.savings}
                allocated={budgetAllocations.savings}
                info="Money you put aside or invest."
                onClick={() => setSheet("savings")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Support row: Upcoming + Weekday side-by-side on desktop */}
        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:grid-rows-1 md:items-stretch md:h-72">
          <UpcomingChargesCard charges={upcomingCharges} />

          {/* Weekday spending chart */}
          <Card className="md:h-full md:flex md:flex-col md:overflow-hidden">
            <CardHeader className="pb-1 pt-4 px-4 flex-row flex-wrap items-center justify-between gap-2 md:shrink-0 md:px-6">
              <CardTitle className="text-sm font-semibold text-foreground"><h2>Spending by day</h2></CardTitle>
              <div role="radiogroup" aria-label="Chart range" className="flex gap-0.5 p-0.5 rounded-lg bg-secondary">
                {CHART_MODES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={weekdayMode === value}
                    onClick={() => selectWeekdayMode(value)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      weekdayMode === value ? "bg-card text-foreground border border-border" : "text-muted-foreground hover:text-foreground border border-transparent"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </CardHeader>
            {weekdayMode === "month" && (
              <div className="px-4 md:px-6 flex items-center gap-1 md:shrink-0">
                <button
                  type="button"
                  onClick={() => stepChartMonth(-1)}
                  className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} aria-hidden />
                </button>
                <span className="text-sm font-medium text-foreground w-32 text-center" aria-live="polite">{chartDateRange}</span>
                <button
                  type="button"
                  onClick={() => stepChartMonth(1)}
                  className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  aria-label="Next month"
                >
                  <ChevronRight size={16} aria-hidden />
                </button>
              </div>
            )}
            <p className="px-4 md:px-6 text-sm text-muted-foreground pb-2 md:shrink-0">
              {chartTakeaway ?? (weekdayMode === "month" ? "No spending in this month." : chartDateRange)}
            </p>
            <CardContent className="px-4 pb-4 md:px-6 md:flex-1 md:min-h-0 md:flex md:flex-col">
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

      </div>

      {/* Drill-down sheet */}
      <Sheet open={sheet !== null} onOpenChange={closeSheet}>
        <SheetContent side="bottom" className="max-h-[60vh] flex flex-col overflow-hidden pt-3 pb-4 px-4">
          {sheet === "income" && (
            <IncomeSheet
              salaryBasis={salaryBasis}
              salaryFromStatement={salaryFromStatement}
              salaryTxIds={salaryTxIds}
              configuredIncome={configuredIncome}
              periodIncomeTxs={periodIncomeTxs}
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
              salaryUsed={salaryUsed}
              salaryFromStatement={salaryFromStatement}
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
