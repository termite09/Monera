"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { Plus, AlertCircle, RefreshCw } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { SummaryCard } from "@/components/budget/SummaryCard";
import { BudgetDonut } from "@/components/budget/BudgetDonut";
import { Modal } from "@/components/ui/Modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Recharts is heavy; load the charts after the shell paints to cut initial JS.
const SpendingPie = dynamic(
  () => import("@/components/charts/SpendingPie").then((m) => m.SpendingPie),
  { ssr: false, loading: () => <Skeleton className="h-[200px] w-full" /> }
);
const DailyTrend = dynamic(
  () => import("@/components/charts/DailyTrend").then((m) => m.DailyTrend),
  { ssr: false, loading: () => <Skeleton className="h-[200px] w-full" /> }
);
import { Button } from "@/components/ui/button";
import { FAB } from "@/components/ui/FAB";
import { AddTransactionForm } from "@/components/transactions/AddTransactionForm";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { useAppData } from "@/contexts/AppDataContext";
import { useBudget } from "@/hooks/useBudget";
import { getRecurringTransactions } from "@/lib/recurring";
import { getCurrentMonth, getPeriodBounds, formatCurrency } from "@/lib/utils";


export default function DashboardPage() {
  const { transactions, settings, isLoading, ready, txError, addManualTransaction, refetch } = useAppData();
  const [month, setMonth] = useState(getCurrentMonth());
  const [showAdd, setShowAdd] = useState(false);

  const paydayOfMonth = settings.paydayOfMonth ?? 1;

  // First-run flow: latch whether this is a brand-new, empty account on first load,
  // so uploading mid-flow doesn't dismiss the flow and existing users (who already
  // have data) never see it. Stays shown until the user finishes (onboarded = true).
  const [wasNewAtLoad, setWasNewAtLoad] = useState<boolean | null>(null);
  useEffect(() => {
    // Wait for everything to actually load (ready) before deciding — otherwise an
    // existing user briefly looks "new" while data is still loading.
    if (wasNewAtLoad !== null || !ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWasNewAtLoad(!settings.onboarded && transactions.length === 0);
  }, [wasNewAtLoad, ready, settings.onboarded, transactions.length]);
  const showOnboarding = !settings.onboarded && wasNewAtLoad === true;

  // Snap to the current period on every mount and whenever the payday loads/changes
  // (its boundaries depend on the payday). Must run on mount so client-side
  // navigation lands on the correct current period, not a calendar month.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMonth(getCurrentMonth(paydayOfMonth));
  }, [paydayOfMonth]);

  // Recurring bills (paid outside Revolut) injected as synthetic expenses
  const recurringTxs = useMemo(
    () => getRecurringTransactions(settings.recurringPayments ?? [], month, paydayOfMonth, settings.currency ?? "EUR"),
    [settings.recurringPayments, month, paydayOfMonth, settings.currency]
  );
  const allTxs = useMemo(() => [...transactions, ...recurringTxs], [transactions, recurringTxs]);

  const { summary, budgetAllocations, incomeIsDetected } = useBudget(allTxs, settings, month);

  const { start, end } = getPeriodBounds(month, paydayOfMonth);
  const monthTxs = allTxs.filter((t) => {
    if (t.excluded) return false;
    const d = new Date(t.date + "T00:00:00");
    return d >= start && d <= end;
  });

  // Money received from others = CSV income excluding salary (one source of
  // truth: useBudget, driven by salaryKeywords). Self-transfers are already
  // removed upstream by filterInternalTransfers.
  const othersText =
    summary.transfersReceived > 0
      ? `+${formatCurrency(summary.transfersReceived)} from others`
      : undefined;
  // When no planned income is set, show that the figure came from the statement.
  const incomeNote = othersText ?? (incomeIsDetected ? "Detected from statement" : undefined);

  const summaryCards = [
    { label: "Income", amount: summary.income, icon: "↑", colorClass: "text-emerald-600 dark:text-emerald-400", accent: "#10b981", secondaryText: incomeNote },
    { label: "Expenses", amount: summary.totalExpenses, icon: "↓", colorClass: "text-foreground", accent: "#64748b" },
    { label: "Remaining", amount: summary.remaining, icon: "=", colorClass: summary.remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive", accent: summary.remaining >= 0 ? "#10b981" : "#ef4444" },
    { label: "Savings", amount: summary.savings, icon: "S", colorClass: "text-primary", accent: "#1C3557" },
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
        <div className="grid grid-cols-2 gap-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card rounded-2xl border border-border/70 p-4 h-[108px]">
                  <Skeleton className="h-3 w-16 mb-3" />
                  <Skeleton className="h-7 w-24 mb-2" />
                </div>
              ))
            : summaryCards.map((card, i) => (
                <SummaryCard key={card.label} {...card} index={i} />
              ))}
        </div>

        <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Budget Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-5">
            <div className="grid grid-cols-3 gap-3">
              <BudgetDonut label="Needs" spent={summary.needs} allocated={budgetAllocations.needs} color="#1C3557" labelClass="text-primary" />
              <BudgetDonut label="Wants" spent={summary.wants} allocated={budgetAllocations.wants} color="#d97706" labelClass="text-amber-600 dark:text-amber-400" />
              <BudgetDonut label="Savings" spent={summary.savings} allocated={budgetAllocations.savings} color="#10b981" labelClass="text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">By Category</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <SpendingPie transactions={allTxs} month={month} paydayOfMonth={paydayOfMonth} />
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Daily Spending</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <DailyTrend transactions={monthTxs} />
            </CardContent>
          </Card>
        </div>

        <div className="hidden md:flex justify-end">
          <Button onClick={() => setShowAdd(true)}>
            <Plus size={16} className="mr-1.5" />
            Add Transaction
          </Button>
        </div>
      </div>

      <FAB onClick={() => setShowAdd(true)} label="Add transaction" />

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Transaction">
        <AddTransactionForm
          onSubmit={async (tx) => { await addManualTransaction(tx); setShowAdd(false); }}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>
    </PageShell>
  );
}
