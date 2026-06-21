"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { AppTour } from "@/components/onboarding/AppTour";
import { useAppData } from "@/contexts/AppDataContext";
import { useBudget } from "@/hooks/useBudget";
import { buildReport, detectSubscriptions } from "@/lib/reports";
import { getRecurringInRange } from "@/lib/recurring";
import { getPeriodBounds, cn } from "@/lib/utils";

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
  const { month, setMonth, transactions, settings, isLoading, updateSettings } = useAppData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<ReportTab>(() => {
    const t = searchParams.get("tab");
    return isReportTab(t) ? t : "overview";
  });
  const paydayOfMonth = settings.paydayOfMonth ?? 1;

  const prevMonthKey = (() => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

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

  const report = useMemo(() => buildReport(allTxs, month, paydayOfMonth), [allTxs, month, paydayOfMonth]);
  const { summary } = useBudget(allTxs, settings, month);
  const savingsRate = summary.income > 0 ? Math.round((summary.savings / summary.income) * 100) : null;

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

  const hiddenMerchants = settings.hiddenMerchants ?? [];

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
  const subscriptions = useMemo(() => detectSubscriptions(transactions), [transactions]);

  return (
    <PageShell>
      <Header month={month} onMonthChange={setMonth} paydayOfMonth={paydayOfMonth} isLoading={isLoading} />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-5">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Insights</h1>
        </div>

        {/* Sub-tab switcher */}
        <div className="flex overflow-x-auto gap-1 p-1 rounded-lg bg-secondary scrollbar-none">
          {REPORT_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 h-9 px-3 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
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
                prevMonthKey={prevMonthKey}
                month={month}
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
