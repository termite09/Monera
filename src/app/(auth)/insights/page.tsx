"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { ErrorState } from "@/components/layout/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { AppTour } from "@/components/onboarding/AppTour";
import { useAppData } from "@/contexts/AppDataContext";
import { useToday } from "@/hooks/useToday";
import { buildPeriodInsights, detectSubscriptions, groupByMerchant } from "@/lib/insights";
import { addMonths, getPeriodRange, inRange, parseDateStr } from "@/lib/periods";
import { addOnce, roundMoney } from "@/lib/utils";
import { Segmented, TabPanel } from "@/components/ui/segmented";

import { MerchantsTab } from "./_tabs/MerchantsTab";
import { SubscriptionsTab } from "./_tabs/SubscriptionsTab";
import { YearTab } from "./_tabs/YearTab";

const INSIGHTS_SLIDES = [
  {
    title: "Your insights",
    body: "Merchants shows where your money went this period, and how that compares with the last.",
  },
  {
    title: "Dig into the detail",
    body: "Subscriptions lists your bills and the regular charges Monera found. Year shows the whole year by pay period.",
  },
];

type InsightsTab = "merchants" | "subscriptions" | "year";

const INSIGHTS_TABS: { value: InsightsTab; label: string }[] = [
  { value: "merchants", label: "Merchants" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "year", label: "Year" },
];

const isInsightsTab = (v: string | null): v is InsightsTab => INSIGHTS_TABS.some((t) => t.value === v);

export default function InsightsPage() {
  const { periodKey, setPeriodKey, transactions, bills, billsStart, settings, isLoading, txError, refetch, updateSettings } = useAppData();
  const { paydayOfMonth } = settings;
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = useToday();
  const [tab, setTab] = useState<InsightsTab>(() => {
    const t = searchParams.get("tab");
    return isInsightsTab(t) ? t : "merchants";
  });
  // Kept here, not in the Year tab, so the header can show it.
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));

  // Recurring bills for BOTH this and the previous period, so the "vs last
  // period" comparison sees last period's bills too. Only what has happened counts.
  const currentTxs = useMemo(() => {
    const from = getPeriodRange(addMonths(periodKey, -1), paydayOfMonth).from;
    const to = getPeriodRange(periodKey, paydayOfMonth).to;
    return [...transactions, ...bills(from, to)].filter((tx) => tx.date <= today);
  }, [transactions, bills, periodKey, paydayOfMonth, today]);

  // The chosen year's pay periods, with their bills; only what has happened so far.
  const yearTxs = useMemo(() => {
    const from = getPeriodRange(`${year}-01`, paydayOfMonth).from;
    const to = getPeriodRange(`${year}-12`, paydayOfMonth).to;
    return [...transactions, ...bills(from, to)].filter((tx) => tx.date <= today);
  }, [transactions, bills, year, paydayOfMonth, today]);

  // Every bill charged so far, for "paid since" on Subscriptions.
  const billsPaid = useMemo(() => bills(billsStart, today), [bills, billsStart, today]);

  const insights = useMemo(
    () => buildPeriodInsights(currentTxs, periodKey, paydayOfMonth, parseDateStr(today)),
    [currentTxs, periodKey, paydayOfMonth, today]
  );

  // Where the money went this period: spending only (savings moves aren't shops).
  const allMerchants = useMemo(() => {
    const range = getPeriodRange(periodKey, paydayOfMonth);
    const spending = currentTxs.filter(
      (tx) => !tx.excluded && tx.type === "expense" && tx.category !== "Savings" && inRange(tx.date, range)
    );
    return groupByMerchant(spending);
  }, [currentTxs, periodKey, paydayOfMonth]);
  const hiddenMerchants = useMemo(() => settings.hiddenMerchants ?? [], [settings.hiddenMerchants]);
  const merchants = useMemo(() => allMerchants.filter((m) => !hiddenMerchants.includes(m.name)), [allMerchants, hiddenMerchants]);
  // Merchant rows are charges; "spent" takes refunds off. The gap is shown so the two add up.
  const charged = roundMoney(allMerchants.reduce((s, m) => s + m.total, 0));
  const refunded = roundMoney(charged - insights.spending);

  // Subscriptions span all history, not just the selected period.
  const allSubscriptions = useMemo(() => detectSubscriptions(transactions), [transactions]);
  const subscriptions = useMemo(
    () => allSubscriptions.filter((s) => !settings.excludedSubscriptions?.includes(s.name)),
    [allSubscriptions, settings.excludedSubscriptions]
  );

  return (
    <PageShell>
      {/* Merchants steps through pay periods, Year through years, Subscriptions through neither. */}
      <Header
        periodKey={periodKey}
        onPeriodChange={setPeriodKey}
        paydayOfMonth={paydayOfMonth}
        isLoading={isLoading}
        showPeriod={tab === "merchants"}
        yearNav={tab === "year" ? { year, onChange: setYear } : undefined}
      />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-5 md:max-w-none md:px-6">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">Insights</h1>

        {txError && <ErrorState message={txError} onRetry={refetch} />}

        <Segmented
          items={INSIGHTS_TABS}
          value={tab}
          onChange={setTab}
          label="Insights sections"
          idPrefix="insights"
          className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-secondary"
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
              {tab === "merchants" && (
                <MerchantsTab
                  hasSpending={allMerchants.length > 0}
                  periodSpending={insights.spending}
                  charged={charged}
                  refunded={refunded}
                  prevSpending={insights.prevSpending}
                  comparedToSamePoint={insights.comparedToSamePoint}
                  merchants={merchants}
                  hiddenCount={hiddenMerchants.length}
                  onHide={(name) => updateSettings((s) => ({ ...s, hiddenMerchants: addOnce(s.hiddenMerchants, name) }))}
                  onResetHidden={() => updateSettings((s) => ({ ...s, hiddenMerchants: [] }))}
                />
              )}
              {tab === "subscriptions" && (
                <SubscriptionsTab
                  recurringPayments={settings.recurringPayments}
                  billsPaid={billsPaid}
                  subscriptions={subscriptions}
                  transactions={transactions}
                  today={today}
                  hiddenCount={allSubscriptions.length - subscriptions.length}
                  onHide={(name) => updateSettings((s) => ({ ...s, excludedSubscriptions: addOnce(s.excludedSubscriptions, name) }))}
                  onRestore={() => updateSettings((s) => ({ ...s, excludedSubscriptions: [] }))}
                />
              )}
              {tab === "year" && (
                <YearTab
                  transactions={yearTxs}
                  paydayOfMonth={paydayOfMonth}
                  year={year}
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
