"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { ErrorState } from "@/components/layout/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { AppTour } from "@/components/onboarding/AppTour";
import { useAppData } from "@/contexts/AppDataContext";
import { useBudget } from "@/hooks/useBudget";
import { buildReport, detectSubscriptions } from "@/lib/reports";
import { getRecurringInRange } from "@/lib/recurring";
import { getPeriodBounds, cn, toDateStr } from "@/lib/utils";

import { OverviewTab } from "./_tabs/OverviewTab";
import { MerchantsTab } from "./_tabs/MerchantsTab";
import { SubscriptionsTab } from "./_tabs/SubscriptionsTab";
import { YearTab } from "./_tabs/YearTab";

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
  const { month, setMonth, transactions, settings, isLoading, txError, refetch, updateSettings } = useAppData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<ReportTab>(() => {
    const t = searchParams.get("tab");
    return isReportTab(t) ? t : "overview";
  });
  const paydayOfMonth = settings.paydayOfMonth ?? 1;

  // Include recurring bills for BOTH the current and the previous period, so
  // buildReport's "vs last period" comparison sees the previous period's
  // recurring bills too.
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

  const todayStr = useMemo(() => toDateStr(new Date()), []);
  const currentTxs = useMemo(() => allTxs.filter((tx) => tx.date <= todayStr), [allTxs, todayStr]);

  const report = useMemo(() => buildReport(currentTxs, month, paydayOfMonth), [currentTxs, month, paydayOfMonth]);
  const { summary } = useBudget(currentTxs, settings, month);
  const savingsRate = summary.income > 0 ? Math.round((summary.savings / summary.income) * 100) : null;

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

  const hiddenMerchants = useMemo(() => settings.hiddenMerchants ?? [], [settings.hiddenMerchants]);

  const allMerchants = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const tx of periodExpenseTxs) {
      if (tx.category === "Savings") continue;
      const prev = map.get(tx.description) ?? { total: 0, count: 0 };
      map.set(tx.description, { total: prev.total + tx.amount, count: prev.count + 1 });
    }
    return [...map.entries()]
      .map(([name, { total, count }]) => ({ name, total: Math.round(total * 100) / 100, count }))
      .sort((a, b) => b.total - a.total)
      .filter((m) => !hiddenMerchants.includes(m.name));
  }, [periodExpenseTxs, hiddenMerchants]);

  // Subscriptions span all history, not just the selected period.
  const allSubscriptions = useMemo(() => detectSubscriptions(transactions), [transactions]);
  const subscriptions = useMemo(
    () => allSubscriptions.filter((s) => !(settings.excludedSubscriptions ?? []).includes(s.name)),
    [allSubscriptions, settings.excludedSubscriptions]
  );
  const excludedSubCount = allSubscriptions.length - subscriptions.length;

  return (
    <PageShell>
      <Header month={month} onMonthChange={setMonth} paydayOfMonth={paydayOfMonth} isLoading={isLoading} />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-5">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Insights</h1>
        </div>

        {txError && <ErrorState message={txError} onRetry={refetch} />}

        {/* Sub-tab switcher */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-secondary">
          {REPORT_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "h-9 rounded-md text-xs font-medium transition-colors",
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
            {tab === "overview" && (
              <OverviewTab
                report={report}
                savingsRate={savingsRate}
              />
            )}
            {tab === "merchants" && (
              <MerchantsTab
                report={report}
                allMerchants={allMerchants}
                periodExpenseTxs={periodExpenseTxs}
                hiddenMerchants={hiddenMerchants}
                onHide={(name) => updateSettings({ ...settings, hiddenMerchants: [...hiddenMerchants, name] })}
                onResetHidden={() => updateSettings({ ...settings, hiddenMerchants: [] })}
              />
            )}
            {tab === "subscriptions" && (
              <SubscriptionsTab
                recurringPayments={settings.recurringPayments ?? []}
                subscriptions={subscriptions}
                transactions={transactions}
                paydayOfMonth={paydayOfMonth}
                excludedSubCount={excludedSubCount}
                onExclude={(name) =>
                  updateSettings({
                    ...settings,
                    excludedSubscriptions: [...(settings.excludedSubscriptions ?? []), name],
                  })
                }
                onRestore={() => updateSettings({ ...settings, excludedSubscriptions: [] })}
              />
            )}
            {tab === "year" && (
              <YearTab
                transactions={transactions}
                recurringPayments={settings.recurringPayments ?? []}
                currency={settings.currency ?? "EUR"}
                paydayOfMonth={paydayOfMonth}
                onMonthClick={(key) => { setMonth(key); router.push("/dashboard"); }}
              />
            )}
          </>
        )}
      </div>

      <AppTour pageKey="reports" slides={REPORTS_SLIDES} />
    </PageShell>
  );
}
