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
import { useToday } from "@/hooks/useToday";
import { buildPeriodInsights, detectSubscriptions, groupByMerchant } from "@/lib/insights";
import { getRecurringInRange } from "@/lib/recurring";
import { addMonths, getPeriodBounds, getPeriodRange, inRange } from "@/lib/utils";
import { Segmented, TabPanel } from "@/components/ui/segmented";

import { OverviewTab } from "./_tabs/OverviewTab";
import { MerchantsTab } from "./_tabs/MerchantsTab";
import { SubscriptionsTab } from "./_tabs/SubscriptionsTab";
import { YearTab } from "./_tabs/YearTab";

const INSIGHTS_SLIDES = [
  {
    title: "Your insights",
    body: "Overview shows how much of your pay you kept and how this period compares with the last.",
  },
  {
    title: "Dig into the detail",
    body: "Merchants shows where your money went. Subscriptions lists the regular charges Monera found, and Year shows the whole year by pay period.",
  },
];

type InsightsTab = "overview" | "merchants" | "subscriptions" | "year";

const INSIGHTS_TABS: { value: InsightsTab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "merchants", label: "Merchants" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "year", label: "Year" },
];

const isInsightsTab = (v: string | null): v is InsightsTab => INSIGHTS_TABS.some((t) => t.value === v);

export default function InsightsPage() {
  const { periodKey, setPeriodKey, transactions, settings, currency, isLoading, txError, refetch, updateSettings } = useAppData();
  const { paydayOfMonth } = settings;
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = useToday();
  const [tab, setTab] = useState<InsightsTab>(() => {
    const t = searchParams.get("tab");
    return isInsightsTab(t) ? t : "overview";
  });

  // Recurring bills for BOTH this and the previous period, so the "vs last
  // period" comparison sees last period's bills too. Only what has happened counts.
  const currentTxs = useMemo(() => {
    const from = getPeriodBounds(addMonths(periodKey, -1), paydayOfMonth).start;
    const to = getPeriodBounds(periodKey, paydayOfMonth).end;
    const bills = getRecurringInRange(settings.recurringPayments, from, to, paydayOfMonth, currency);
    return [...transactions, ...bills].filter((tx) => tx.date <= today);
  }, [transactions, settings.recurringPayments, currency, periodKey, paydayOfMonth, today]);

  const insights = useMemo(
    () => buildPeriodInsights(currentTxs, periodKey, paydayOfMonth, new Date()),
    [currentTxs, periodKey, paydayOfMonth]
  );
  const { summary } = useBudget(currentTxs, settings, periodKey);
  const savingsRate = summary.income > 0 ? Math.round((summary.savings / summary.income) * 100) : null;

  const hiddenMerchants = useMemo(() => settings.hiddenMerchants ?? [], [settings.hiddenMerchants]);
  // Where the money went this period: spending only (savings moves aren't shops).
  const merchants = useMemo(() => {
    const range = getPeriodRange(periodKey, paydayOfMonth);
    const spending = currentTxs.filter(
      (tx) => !tx.excluded && tx.type === "expense" && tx.category !== "Savings" && inRange(tx.date, range)
    );
    return groupByMerchant(spending).filter((m) => !hiddenMerchants.includes(m.name));
  }, [currentTxs, periodKey, paydayOfMonth, hiddenMerchants]);

  // Subscriptions span all history, not just the selected period.
  const allSubscriptions = useMemo(() => detectSubscriptions(transactions), [transactions]);
  const subscriptions = useMemo(
    () => allSubscriptions.filter((s) => !settings.excludedSubscriptions?.includes(s.name)),
    [allSubscriptions, settings.excludedSubscriptions]
  );

  return (
    <PageShell>
      {/* Year and Subscriptions aren't about one pay period, so no period arrows there. */}
      <Header periodKey={periodKey} onPeriodChange={setPeriodKey} paydayOfMonth={paydayOfMonth} isLoading={isLoading} showPeriod={tab === "overview" || tab === "merchants"} />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-5 md:max-w-none md:px-6">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">Insights</h1>

        {txError && <ErrorState message={txError} onRetry={refetch} />}

        <Segmented
          items={INSIGHTS_TABS}
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
                  insights={insights}
                  savingsRate={savingsRate}
                  savingsTargetPct={(settings.monthlyBudgets[periodKey]?.budgetRule ?? settings.defaultBudgetRule).savings}
                />
              )}
              {tab === "merchants" && (
                <MerchantsTab
                  hasSpending={insights.txCount > 0}
                  periodSpending={insights.spending}
                  merchants={merchants}
                  hiddenCount={hiddenMerchants.length}
                  onHide={(name) => updateSettings({ ...settings, hiddenMerchants: [...hiddenMerchants, name] })}
                  onResetHidden={() => updateSettings({ ...settings, hiddenMerchants: [] })}
                />
              )}
              {tab === "subscriptions" && (
                <SubscriptionsTab
                  recurringPayments={settings.recurringPayments}
                  subscriptions={subscriptions}
                  transactions={transactions}
                  paydayOfMonth={paydayOfMonth}
                  today={today}
                  hiddenCount={allSubscriptions.length - subscriptions.length}
                  onHide={(name) => updateSettings({ ...settings, excludedSubscriptions: [...(settings.excludedSubscriptions ?? []), name] })}
                  onRestore={() => updateSettings({ ...settings, excludedSubscriptions: [] })}
                />
              )}
              {tab === "year" && (
                <YearTab
                  transactions={transactions}
                  recurringPayments={settings.recurringPayments}
                  currency={currency}
                  paydayOfMonth={paydayOfMonth}
                  today={today}
                  onPeriodClick={(key) => { setPeriodKey(key); router.push("/dashboard"); }}
                />
              )}
            </>
          )}
        </TabPanel>
      </div>

      {/* The tour's saved key is still "reports", from before this page was renamed. */}
      <AppTour pageKey="reports" slides={INSIGHTS_SLIDES} />
    </PageShell>
  );
}
