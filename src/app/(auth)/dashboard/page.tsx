"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { SummaryCard } from "@/components/budget/SummaryCard";
import { BudgetDonut } from "@/components/budget/BudgetDonut";
import { SpendingPie } from "@/components/charts/SpendingPie";
import { DailyTrend } from "@/components/charts/DailyTrend";
import { Modal } from "@/components/ui/Modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FAB } from "@/components/ui/FAB";
import { AddTransactionForm } from "@/components/transactions/AddTransactionForm";
import { useAppData } from "@/contexts/AppDataContext";
import { useAuth } from "@/hooks/useAuth";
import { useBudget } from "@/hooks/useBudget";
import { getRecurringTransactions } from "@/lib/recurring";
import { getCurrentMonth, getPeriodBounds, formatCurrency } from "@/lib/utils";


export default function DashboardPage() {
  const { transactions, settings, isLoading, addManualTransaction } = useAppData();
  const { session } = useAuth();
  const [month, setMonth] = useState(getCurrentMonth());
  const [showAdd, setShowAdd] = useState(false);

  const paydayOfMonth = settings.paydayOfMonth ?? 1;

  // Recurring bills (paid outside Revolut) injected as synthetic expenses
  const recurringTxs = useMemo(
    () => getRecurringTransactions(settings.recurringPayments ?? [], month, paydayOfMonth),
    [settings.recurringPayments, month, paydayOfMonth]
  );
  const allTxs = useMemo(() => [...transactions, ...recurringTxs], [transactions, recurringTxs]);

  const { summary, budgetAllocations } = useBudget(allTxs, settings, month);

  useEffect(() => {
    setMonth(getCurrentMonth(paydayOfMonth));
  }, [paydayOfMonth]);

  const { start, end } = getPeriodBounds(month, paydayOfMonth);
  const monthTxs = allTxs.filter((t) => {
    if (t.excluded) return false;
    const d = new Date(t.date + "T00:00:00");
    return d >= start && d <= end;
  });

  // Auto-detect self-transfers by matching user's own name in description
  const nameWords = (session?.user?.name ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 4);

  const monthIncomeTxs = monthTxs.filter((t) => t.type === "income");
  const othersTotal = monthIncomeTxs
    .filter((t) => {
      const desc = t.description.toLowerCase();
      return nameWords.length === 0 || !nameWords.some((w) => desc.includes(w));
    })
    .reduce((s, t) => s + t.amount, 0);

  const othersText = othersTotal > 0 ? `+${formatCurrency(othersTotal)} from others` : undefined;

  const summaryCards = [
    { label: "Income", amount: summary.income, icon: "↑", colorClass: "text-emerald-600 dark:text-emerald-400", accent: "#10b981", secondaryText: othersText },
    { label: "Expenses", amount: summary.totalExpenses, icon: "↓", colorClass: "text-foreground", accent: "#64748b" },
    { label: "Remaining", amount: summary.remaining, icon: "=", colorClass: summary.remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive", accent: summary.remaining >= 0 ? "#10b981" : "#ef4444" },
    { label: "Savings", amount: summary.savings, icon: "S", colorClass: "text-primary", accent: "#1C3557" },
  ];

  return (
    <PageShell>
      <Header month={month} onMonthChange={setMonth} paydayOfMonth={paydayOfMonth} isLoading={isLoading} />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-5">
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
              <SpendingPie transactions={monthTxs} />
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Daily Spending</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <DailyTrend transactions={monthTxs} month={month} />
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
          paydayOfMonth={paydayOfMonth}
          onSubmit={async (tx) => { await addManualTransaction(tx); setShowAdd(false); }}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>
    </PageShell>
  );
}
