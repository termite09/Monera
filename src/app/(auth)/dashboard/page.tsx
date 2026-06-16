"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { SummaryCard } from "@/components/budget/SummaryCard";
import { BudgetBar } from "@/components/budget/BudgetBar";
import { SpendingPie } from "@/components/charts/SpendingPie";
import { DailyTrend } from "@/components/charts/DailyTrend";
import { Modal } from "@/components/ui/Modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FAB } from "@/components/ui/FAB";
import { Separator } from "@/components/ui/separator";
import { AddTransactionForm } from "@/components/transactions/AddTransactionForm";
import { useAppData } from "@/contexts/AppDataContext";
import { useBudget } from "@/hooks/useBudget";
import { getCurrentMonth, getPeriodBounds, formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const { transactions, settings, isLoading, addManualTransaction } = useAppData();
  const [month, setMonth] = useState(getCurrentMonth());
  const [showAdd, setShowAdd] = useState(false);

  const { summary, budgetAllocations, paydayOfMonth } = useBudget(transactions, settings, month);

  useEffect(() => {
    setMonth(getCurrentMonth(paydayOfMonth));
  }, [paydayOfMonth]);

  const { start, end } = getPeriodBounds(month, paydayOfMonth);
  const monthTxs = transactions.filter((t) => {
    const d = new Date(t.date + "T00:00:00");
    return d >= start && d <= end;
  });

  const salaryKeywords = settings.salaryKeywords ?? [];
  const monthIncomeTxs = monthTxs.filter((t) => t.type === "income");
  const salaryTxs = monthIncomeTxs.filter((t) =>
    salaryKeywords.length > 0 &&
    salaryKeywords.some((k) => t.description.toLowerCase().includes(k.toLowerCase()))
  );
  const otherIncomeTxs = monthIncomeTxs.filter((t) => !salaryTxs.includes(t));
  const salaryTotal = salaryTxs.reduce((s, t) => s + t.amount, 0);
  const otherIncomeTotal = otherIncomeTxs.reduce((s, t) => s + t.amount, 0);

  const summaryCards = [
    { label: "Expenses", amount: summary.totalExpenses, icon: "↓", colorClass: "text-foreground" },
    { label: "Remaining", amount: summary.remaining, icon: "=", colorClass: summary.remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive" },
    { label: "Savings", amount: summary.savings, icon: "S", colorClass: "text-primary" },
  ];

  return (
    <PageShell>
      <Header month={month} onMonthChange={setMonth} paydayOfMonth={paydayOfMonth} isLoading={isLoading} />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-5">
        {/* Income card — full width with salary/other split */}
        {isLoading ? (
          <div className="bg-card rounded-xl border border-border p-4">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-7 w-24 mb-2" />
          </div>
        ) : (
          <Card className="shadow-none border-border col-span-2">
            <CardContent className="p-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Income</p>
                <p className="text-2xl font-medium tabular-nums text-emerald-600 dark:text-emerald-400" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {formatCurrency(summary.income)}
                </p>
              </div>
              {salaryKeywords.length > 0 && (
                <div className="flex flex-col gap-1 items-end text-right mt-1">
                  <div>
                    <p className="text-xs text-muted-foreground">Salary</p>
                    <p className="text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400" style={{ fontFamily: "'DM Mono', monospace" }}>
                      {formatCurrency(salaryTotal)}
                    </p>
                  </div>
                  {otherIncomeTotal > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Transfers & other</p>
                      <p className="text-sm font-medium tabular-nums text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
                        {formatCurrency(otherIncomeTotal)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Other summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-card rounded-xl border border-border p-4">
                  <Skeleton className="h-3 w-16 mb-3" />
                  <Skeleton className="h-7 w-24 mb-2" />
                </div>
              ))
            : summaryCards.map((card, i) => (
                <SummaryCard key={card.label} {...card} index={i} />
              ))}
        </div>

        <Card className="shadow-none border-border">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Budget Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex flex-col gap-4">
            <BudgetBar label="Needs" spent={summary.needs} allocated={budgetAllocations.needs} colorClass="text-primary" />
            <Separator />
            <BudgetBar label="Wants" spent={summary.wants} allocated={budgetAllocations.wants} colorClass="text-amber-600 dark:text-amber-400" />
            <Separator />
            <BudgetBar label="Savings" spent={summary.savings} allocated={budgetAllocations.savings} colorClass="text-emerald-600 dark:text-emerald-400" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="shadow-none border-border">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">By Category</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <SpendingPie transactions={monthTxs} />
            </CardContent>
          </Card>
          <Card className="shadow-none border-border">
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
