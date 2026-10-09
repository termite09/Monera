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
import { buildReport, detectSubscriptions, merchantKey, displayName } from "@/lib/reports";
import { getRecurringInRange } from "@/lib/recurring";
import { getUpcomingCharges } from "@/lib/upcomingCharges";
import { computeSafeToSpend } from "@/lib/safeToSpend";
import { landingByBudget } from "@/lib/forecast";
import { getPeriodBounds, toDateStr } from "@/lib/utils";
import { Segmented, TabPanel } from "@/components/ui/segmented";

import { OverviewTab } from "./_tabs/OverviewTab";
import { MerchantsTab } from "./_tabs/MerchantsTab";
import { SubscriptionsTab } from "./_tabs/SubscriptionsTab";
import { YearTab } from "./_tabs/YearTab";

const REPORTS_SLIDES = [
  {
    title: "Your insights",
    body: "Overview shows how much of your pay you kept, where you'll be by payday, and how this period compares with the last.",
  },
  {
    title: "Dig into the detail",
    body: "Merchants shows where your money went. Subscriptions lists the regular charges Monera found, and Year shows the whole year by pay period.",
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

  // Subscriptions we expect to charge before payday — the same list the
  // dashboard's Safe to spend holds back.
  const expectedCharges = useMemo(() => {
    const { end } = getPeriodBounds(month, paydayOfMonth);
    const today = new Date(todayStr + "T00:00:00");
    const daysToPayday = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000));
    const subs = detectSubscriptions(transactions).filter((s) => !(settings.excludedSubscriptions ?? []).includes(s.name));
    return getUpcomingCharges([], subs, today, daysToPayday)
      .filter((c) => c.isEstimated)
      .map((c) => ({ name: c.name, amount: c.amount, date: c.date, lastChargeDate: c.lastChargeDate }));
  }, [transactions, settings.excludedSubscriptions, month, paydayOfMonth, todayStr]);

  // Known spending still to come before payday (bills + expected subscriptions),
  // so "By payday" lines up with Safe to spend on the dashboard.
  const upcomingSpend = useMemo(() => {
    const endStr = toDateStr(getPeriodBounds(month, paydayOfMonth).end);
    const bills = allTxs.filter((t) => !t.excluded && t.type === "expense" && t.category !== "Savings" && t.date > todayStr && t.date <= endStr);
    const known = new Set(bills.map((b) => b.description.toLowerCase()));
    const expected = expectedCharges.filter((c) => !known.has(c.name.toLowerCase()));
    return bills.reduce((s, t) => s + t.amount, 0) + expected.reduce((s, c) => s + c.amount, 0);
  }, [allTxs, expectedCharges, month, paydayOfMonth, todayStr]);

  const report = useMemo(
    () => buildReport(currentTxs, month, paydayOfMonth, new Date(), upcomingSpend),
    [currentTxs, month, paydayOfMonth, upcomingSpend]
  );
  const { summary, budgetAllocations } = useBudget(currentTxs, settings, month);
  const safeInfo = useMemo(
    () => computeSafeToSpend(allTxs, settings, month, summary, new Date(), budgetAllocations.savings, expectedCharges),
    [allTxs, settings, month, summary, budgetAllocations.savings, expectedCharges]
  );
  // Where Needs and Wants each land by payday at this pace (bills still due included).
  const landing = useMemo(() => {
    const endStr = toDateStr(getPeriodBounds(month, paydayOfMonth).end);
    const due = { Needs: 0, Wants: 0 };
    const known = new Set<string>();
    for (const t of allTxs) {
      if (t.excluded || t.type !== "expense" || t.category === "Savings" || t.date <= todayStr || t.date > endStr) continue;
      known.add(t.description.toLowerCase());
      if (t.category === "Needs") due.Needs += t.amount; else due.Wants += t.amount;
    }
    for (const c of expectedCharges) if (!known.has(c.name.toLowerCase())) due.Wants += c.amount;
    const cat = (c: string) => report.byCategory.find((x) => x.category === c)?.total ?? 0;
    return landingByBudget(
      { Needs: budgetAllocations.needs, Wants: budgetAllocations.wants },
      { Needs: cat("Needs"), Wants: cat("Wants") + cat("Uncategorized") },
      due,
      report.projectedPaceBy,
    );
  }, [allTxs, expectedCharges, month, paydayOfMonth, todayStr, report, budgetAllocations]);
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
    // Group by the normalised shop name so "Wolt" and "Wolt 123" are one place.
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const tx of periodExpenseTxs) {
      if (tx.category === "Savings") continue;
      const key = merchantKey(tx.description) || "other";
      const prev = map.get(key) ?? { name: displayName(tx.description), total: 0, count: 0 };
      map.set(key, { name: prev.name, total: prev.total + tx.amount, count: prev.count + 1 });
    }
    return [...map.entries()]
      .map(([key, { name, total, count }]) => ({ key, name, total: Math.round(total * 100) / 100, count }))
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
      {/* Year and Subscriptions aren't about one pay period, so no period arrows there. */}
      <Header month={month} onMonthChange={setMonth} paydayOfMonth={paydayOfMonth} isLoading={isLoading} showPeriod={tab === "overview" || tab === "merchants"} />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-5 md:max-w-none md:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">Insights</h1>
        </div>

        {txError && <ErrorState message={txError} onRetry={refetch} />}

        {/* Sub-tab switcher */}
        <Segmented
          items={REPORT_TABS.map((t) => ({ value: t.id, label: t.label }))}
          value={tab}
          onChange={setTab}
          label="Insights sections"
          idPrefix="insights"
          className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-secondary"
          itemClassName="h-10 rounded-md text-xs sm:text-sm"
        />

        <TabPanel idPrefix="insights" value={tab} className="flex flex-col gap-4">
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
                safeToSpend={safeInfo.applicable ? safeInfo.safe : null}
                landing={landing}
                savingsTargetPct={settings.monthlyBudgets[month]?.budgetRule.savings ?? settings.defaultBudgetRule.savings}
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
        </TabPanel>
      </div>

      <AppTour pageKey="reports" slides={REPORTS_SLIDES} />
    </PageShell>
  );
}
