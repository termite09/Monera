"use client";

import { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { ErrorState } from "@/components/layout/ErrorState";
import { Header } from "@/components/layout/Header";
import { SummaryCard } from "@/components/budget/SummaryCard";
import { BudgetDonut } from "@/components/budget/BudgetDonut";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/components/ui/segmented";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { AppTour } from "@/components/onboarding/AppTour";
import { UpcomingChargesCard } from "@/components/dashboard/UpcomingChargesCard";
import { useAppData } from "@/contexts/AppDataContext";
import { useToday } from "@/hooks/useToday";
import { dailyAllowance } from "@/lib/safeToSpend";
import { addMonths, cleanDescription, formatCurrency, formatDate, formatLongDate, formatShortDate, parseDateStr, toDateStr } from "@/lib/utils";
import { buildWeekdayData, chartRangeLabel, fullDayName, weekdayTransactions, type WeekdayChartMode, type WeekdayPoint } from "@/lib/weekday";
import { useDashboardData } from "./useDashboardData";
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

const EMPTY_CHART_LABEL: Record<WeekdayChartMode, string> = {
  week: "No spending this week",
  month: "No spending this calendar month",
  period: "No spending this period",
  year: "No spending this year",
};

const DONUTS = [
  { category: "Needs", allocation: "needs", info: "Essential spending — rent, groceries, bills, transport." },
  { category: "Wants", allocation: "wants", info: "Everything optional — eating out, shopping, subscriptions." },
  { category: "Savings", allocation: "savings", info: "Money you put aside or invest." },
] as const;

type SheetKind = "income" | "expenses" | "savings" | "remaining" | "weekday" | "safe";

/** The current calendar month as "YYYY-MM" — the Month chart is calendar-based, not pay periods. */
const thisCalendarMonth = () => toDateStr(new Date()).slice(0, 7);

const money = (n: number) => <span className="font-mono tabular-nums font-medium text-foreground">{formatCurrency(n)}</span>;

export default function DashboardPage() {
  const router = useRouter();
  const { periodKey, setPeriodKey, transactions, settings, currency, isLoading, ready, txError, refetch, updateSettings } = useAppData();
  const { paydayOfMonth } = settings;
  const today = useToday();
  const {
    range, currentTxs, budget, safeInfo, periodExpenseTxs, periodIncomeTxs, periodSavingsTxs,
    latestImported, timing, noStatement, dueBy, payday,
  } = useDashboardData({ transactions, settings, currency, periodKey, today });
  const { summary, budgetAllocations, uncategorizedExpense, unconfirmedSalaryTx } = budget;

  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [expandedCat, setExpandedCat] = useState<"Needs" | "Wants" | null>(null);
  const [weekdayPoint, setWeekdayPoint] = useState<WeekdayPoint | null>(null);
  const [salaryPromptDismissed, setSalaryPromptDismissed] = useState(false);

  // The chart: Month mode has its own month picker; every other mode follows the
  // pay period in the header.
  const [weekdayMode, setWeekdayMode] = useState<WeekdayChartMode>("week");
  const [chartMonth, setChartMonth] = useState(thisCalendarMonth);
  const chartKey = weekdayMode === "month" ? chartMonth : periodKey;
  const todayDate = useMemo(() => parseDateStr(today), [today]);
  const chartData = useMemo(
    () => buildWeekdayData(currentTxs, weekdayMode, chartKey, paydayOfMonth, todayDate),
    [currentTxs, weekdayMode, chartKey, paydayOfMonth, todayDate]
  );
  const chartLabel = chartRangeLabel(weekdayMode, chartKey, paydayOfMonth, todayDate);

  const selectWeekdayMode = useCallback((mode: WeekdayChartMode) => {
    // The Month picker always opens on the current calendar month.
    if (mode === "month") setChartMonth(thisCalendarMonth());
    setWeekdayMode(mode);
  }, []);

  const closeSheet = useCallback(() => {
    setSheet(null);
    setExpandedCat(null);
    setWeekdayPoint(null);
  }, []);
  const goTo = (href: string) => { closeSheet(); router.push(href); };

  const handleDayClick = useCallback((point: WeekdayPoint) => {
    setWeekdayPoint(point);
    setSheet("weekday");
  }, []);

  // "Is this your pay?" — confirming saves a salary keyword so the deposit is
  // recognised every period; dismissing hides it for this visit.
  const confirmSalary = async () => {
    if (!unconfirmedSalaryTx) return;
    const keyword = cleanDescription(unconfirmedSalaryTx.description).toLowerCase();
    await updateSettings({ ...settings, salaryKeywords: [...settings.salaryKeywords, keyword] });
  };

  // Onboarding shows until the user completes the wizard (which persists
  // `onboarded: true`), regardless of whether they uploaded first — so payday,
  // salary, and budget split always get collected. Guarded by `ready` to avoid
  // a flash before settings load.
  if (ready && !settings.onboarded) {
    return (
      <PageShell>
        <Onboarding />
      </PageShell>
    );
  }

  // Onboarded but no data yet → guide the user to import a statement instead of
  // showing zero-value cards. Excludes the load-error case (so the retry banner
  // shows instead) and bills-only accounts (which do render real budget data).
  if (ready && !isLoading && !txError && transactions.length === 0 && settings.recurringPayments.length === 0) {
    return (
      <PageShell>
        <Header periodKey={periodKey} onPeriodChange={setPeriodKey} paydayOfMonth={paydayOfMonth} isLoading={isLoading} />
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
              <Button asChild>
                <Link href="/upload"><Upload size={16} className="mr-1.5" aria-hidden />Import a statement</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  const paydayLabel = formatLongDate(payday);
  const freshness = latestImported ? <>Statement up to {formatShortDate(latestImported)}</> : null;

  // The one tile that answers "can I spend?": forward-looking in the live period,
  // the final "Remaining" otherwise.
  const allowance = safeInfo.applicable ? dailyAllowance(safeInfo.safe, safeInfo.daysLeft) : null;
  const heroCard = safeInfo.applicable
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
        onClick: () => setSheet("safe"),
      }
    : {
        label: "Remaining",
        amount: summary.remaining,
        negative: summary.remaining < 0,
        sentence:
          safeInfo.reason === "no-income" ? <>Add your pay in Settings to see what&apos;s safe to spend before payday.</>
          : timing === "future" ? <>This pay period hasn&apos;t started yet.</>
          : summary.remaining >= 0 ? <>Left over from this pay period.</>
          : <>You spent more than came in this pay period.</>,
        note: timing === "current" ? freshness : null,
        onClick: () => setSheet("remaining"),
      };

  const summaryCards = [
    // Until the pay shows up in a statement, the figure is only what the user
    // told us to expect — so no "+", which would read as money received.
    { label: "Income", amount: summary.income, sign: budget.salaryBasis > 0 && !budget.salaryFromStatement ? "" : "+", onClick: () => setSheet("income") },
    // No statement for this period yet: we don't know what was spent or saved.
    { label: "Spent", amount: noStatement ? null : summary.totalExpenses - summary.savings, onClick: () => setSheet("expenses") },
    { label: "Saved", amount: noStatement ? null : summary.savings, onClick: () => setSheet("savings") },
  ];

  const donutSpent = {
    Needs: summary.needs,
    // Unsorted spending counts against Wants, the flexible budget.
    Wants: summary.wants + uncategorizedExpense,
    Savings: summary.savings,
  };

  // One-line takeaway so the chart reads without an axis.
  const chartPeak = chartData.find((d) => d.isMax);
  const chartScope = weekdayMode === "month" ? `in ${chartLabel.split(" ")[0]}` : weekdayMode === "year" ? "this year" : "this period";
  const chartTakeaway = !chartPeak ? null
    : weekdayMode === "week" ? <>Most spent this week: {fullDayName(chartPeak.day)}, {money(chartPeak.amount)}.</>
    : <>{fullDayName(chartPeak.day)}s cost you the most {chartScope}: {money(chartPeak.amount)}.</>;

  return (
    <PageShell>
      <Header periodKey={periodKey} onPeriodChange={setPeriodKey} paydayOfMonth={paydayOfMonth} isLoading={isLoading} />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-3 pt-4 md:max-w-none md:px-6 md:pt-3 md:pb-0">
        <h1 className="sr-only">Dashboard</h1>
        <p className="text-base text-muted-foreground">
          {timing === "current" ? (
            <><span className="font-semibold text-foreground">Today</span> · {formatLongDate(todayDate)}</>
          ) : timing === "past" ? (
            <><span className="font-semibold text-foreground">Past pay period</span> · ended {formatLongDate(parseDateStr(range.to))}</>
          ) : (
            <><span className="font-semibold text-foreground">Upcoming pay period</span> · starts {formatLongDate(parseDateStr(range.from))}</>
          )}
        </p>

        {txError && <ErrorState message={txError} onRetry={refetch} />}

        {/* Summary: the answer first, then the three figures behind it */}
        <div className="grid gap-2 sm:gap-3 md:grid-cols-[3fr_2fr]">
          {isLoading ? (
            <>
              <div className="bg-card rounded-xl border border-border p-5 h-36">
                <Skeleton className="h-3.5 w-24 mb-3" />
                <Skeleton className="h-9 w-36 mb-3" />
                <Skeleton className="h-3.5 w-full max-w-72" />
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-card rounded-xl border border-border p-4 h-20 md:h-auto">
                    <Skeleton className="h-3 w-14 mb-2" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {noStatement ? (
                // No statement for this period: say so plainly and offer the one
                // action that fixes it, as a real button.
                <section aria-labelledby="safe-heading" className="rounded-xl border border-border bg-card p-5 md:px-6 flex flex-col gap-1.5">
                  <h2 id="safe-heading" className="text-sm font-semibold text-foreground">Safe to spend</h2>
                  <p className="font-mono tabular-nums font-medium text-3xl sm:text-4xl leading-tight text-muted-foreground" aria-hidden>—</p>
                  <p className="text-base leading-relaxed text-foreground/80 max-w-[52ch]">
                    Add this pay period&apos;s statement to see what&apos;s safe to spend before payday on {paydayLabel}.
                  </p>
                  {latestImported && <p className="text-xs text-muted-foreground">Your latest statement ends {formatShortDate(latestImported)}.</p>}
                  <Button asChild className="mt-2 self-start">
                    <Link href="/upload"><Upload size={16} className="mr-1.5" aria-hidden />Add this period&apos;s statement</Link>
                  </Button>
                </section>
              ) : (
                <SummaryCard {...heroCard} variant="hero" index={0} />
              )}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-1">
                {summaryCards.map((card, i) => (
                  <SummaryCard key={card.label} {...card} index={i + 1} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pay confirmation — the deposit we took to be pay, until it's confirmed */}
        {!isLoading && unconfirmedSalaryTx && !salaryPromptDismissed && (
          <section aria-labelledby="pay-heading" className="rounded-xl border border-primary/30 bg-primary/3 px-4 py-4 md:px-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 min-w-0">
              <h2 id="pay-heading" className="text-base font-semibold text-foreground">Is this your pay?</h2>
              <p className="text-sm text-foreground/80 mt-0.5">
                We found {money(unconfirmedSalaryTx.amount)} from {cleanDescription(unconfirmedSalaryTx.description)} on {formatShortDate(unconfirmedSalaryTx.date)}, and we&apos;re counting it as your pay instead of the amount you entered.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={confirmSalary}>Yes, that&apos;s my pay</Button>
              <Button size="sm" variant="outline" onClick={() => { setSalaryPromptDismissed(true); router.push("/settings?tab=basics"); }}>
                No
              </Button>
            </div>
          </section>
        )}

        {/* Budget progress */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4 md:px-6">
            <CardTitle className="text-lg font-semibold text-foreground">
              <h2>Budget progress</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-5 md:px-6">
            <div className="grid grid-cols-3 gap-3 mt-2 md:max-w-2xl md:mx-auto">
              {DONUTS.map(({ category, allocation, info }) => (
                <BudgetDonut
                  key={category}
                  category={category}
                  spent={donutSpent[category]}
                  due={dueBy[category]}
                  allocated={budgetAllocations[allocation]}
                  expected={noStatement}
                  info={info}
                  onClick={() => {
                    if (category !== "Savings") setExpandedCat(category);
                    setSheet(category === "Savings" ? "savings" : "expenses");
                  }}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Support row: Upcoming + Weekday side-by-side on desktop */}
        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:items-start">
          <UpcomingChargesCard
            charges={safeInfo.billItems}
            periodTiming={timing}
            today={today}
            paydayLabel={formatShortDate(toDateStr(payday))}
          />

          {/* Weekday spending chart */}
          <Card className="md:flex md:flex-col">
            <CardHeader className="pb-1 pt-4 px-4 flex-row flex-wrap items-center justify-between gap-2 md:shrink-0 md:px-6">
              <CardTitle className="text-lg font-semibold text-foreground"><h2>Spending by day</h2></CardTitle>
              <Segmented
                items={CHART_MODES}
                value={weekdayMode}
                onChange={selectWeekdayMode}
                label="Chart range"
                kind="radio"
                className="flex gap-0.5 p-0.5 rounded-lg bg-secondary"
                itemClassName="min-h-11 sm:min-h-8 px-3 rounded-md text-sm"
              />
            </CardHeader>
            {weekdayMode === "month" && (
              <div className="px-4 md:px-6 flex items-center gap-1 md:shrink-0">
                <button
                  type="button"
                  onClick={() => setChartMonth((m) => addMonths(m, -1))}
                  className="flex items-center justify-center size-11 sm:size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} aria-hidden />
                </button>
                <span className="text-sm font-medium text-foreground w-32 text-center" aria-live="polite">{chartLabel}</span>
                <button
                  type="button"
                  onClick={() => setChartMonth((m) => addMonths(m, 1))}
                  className="flex items-center justify-center size-11 sm:size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  aria-label="Next month"
                >
                  <ChevronRight size={16} aria-hidden />
                </button>
              </div>
            )}
            <p className="px-4 md:px-6 text-sm text-muted-foreground pb-2 md:shrink-0">
              {chartTakeaway ?? (weekdayMode === "month" && !noStatement ? "No spending in this month." : chartLabel)}
            </p>
            <CardContent className="px-4 pb-4 md:px-6 md:flex-1 md:min-h-0 md:flex md:flex-col">
              <WeekdayChart
                data={chartData}
                onDayClick={handleDayClick}
                emptyLabel={noStatement ? "No statement yet" : EMPTY_CHART_LABEL[weekdayMode]}
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
              salaryBasis={budget.salaryBasis}
              salaryFromStatement={budget.salaryFromStatement}
              salaryTxIds={budget.salaryTxIds}
              configuredIncome={settings.monthlyBudgets[periodKey]?.income ?? 0}
              periodIncomeTxs={periodIncomeTxs}
              onManage={() => goTo("/transactions")}
            />
          )}
          {sheet === "expenses" && (
            <ExpensesSheet
              summary={summary}
              uncategorizedExpense={uncategorizedExpense}
              periodExpenseTxs={periodExpenseTxs}
              expandedCat={expandedCat}
              setExpandedCat={setExpandedCat}
              onSort={() => goTo("/transactions?category=Uncategorized")}
              budget={{ Needs: budgetAllocations.needs, Wants: budgetAllocations.wants }}
            />
          )}
          {sheet === "savings" && (
            <SavingsSheet periodSavingsTxs={periodSavingsTxs} onSettings={() => goTo("/settings?tab=basics")} />
          )}
          {sheet === "remaining" && (
            <RemainingSheet
              summary={summary}
              salaryUsed={budget.salaryUsed}
              salaryFromStatement={budget.salaryFromStatement}
              additionalIncome={budget.additionalIncome}
              onReview={() => goTo("/transactions")}
            />
          )}
          {sheet === "safe" && <SafeToSpendSheet safeInfo={safeInfo} />}
          {sheet === "weekday" && weekdayPoint && (
            <WeekdaySheet
              point={weekdayPoint}
              transactions={weekdayTransactions(currentTxs, weekdayMode, chartKey, paydayOfMonth, todayDate, weekdayPoint)}
              rangeLabel={chartLabel}
              title={
                weekdayPoint.dateStr
                  ? `${weekdayPoint.day} · ${formatDate(weekdayPoint.dateStr)}`
                  : `${weekdayPoint.day} spending`
              }
            />
          )}
        </SheetContent>
      </Sheet>

      <AppTour pageKey="dashboard" slides={DASHBOARD_SLIDES} />
    </PageShell>
  );
}
