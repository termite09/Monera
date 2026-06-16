"use client";

import { useState } from "react";
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
import { useAuth } from "@/hooks/useAuth";
import { useDrive } from "@/hooks/useDrive";
import { useTransactions } from "@/hooks/useTransactions";
import { useBudget } from "@/hooks/useBudget";
import { getCurrentMonth } from "@/lib/utils";

export default function DashboardPage() {
  const { accessToken } = useAuth();
  const { structure } = useDrive(accessToken);
  const [month, setMonth] = useState(getCurrentMonth());
  const [showAdd, setShowAdd] = useState(false);

  const { transactions, isLoading, addManualTransaction } = useTransactions(accessToken, structure);
  const { summary, budgetAllocations } = useBudget(accessToken, structure, transactions, month);

  const monthTxs = transactions.filter((t) => t.month === month);

  const summaryCards = [
    { label: "Income", amount: summary.income, icon: "↑", colorClass: "text-emerald-600 dark:text-emerald-400" },
    { label: "Expenses", amount: summary.totalExpenses, icon: "↓", colorClass: "text-foreground" },
    { label: "Remaining", amount: summary.remaining, icon: "=", colorClass: summary.remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive" },
    { label: "Savings", amount: summary.savings, icon: "S", colorClass: "text-primary" },
  ];

  return (
    <PageShell>
      <Header month={month} onMonthChange={setMonth} />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 pt-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card rounded-xl border border-border p-4">
                  <Skeleton className="h-3 w-16 mb-3" />
                  <Skeleton className="h-7 w-24 mb-2" />
                </div>
              ))
            : summaryCards.map((card, i) => (
                <SummaryCard key={card.label} {...card} index={i} />
              ))}
        </div>

        {/* Budget Progress */}
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

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="shadow-none border-border">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                By Category
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <SpendingPie transactions={monthTxs} />
            </CardContent>
          </Card>
          <Card className="shadow-none border-border">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Daily Spending
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <DailyTrend transactions={monthTxs} month={month} />
            </CardContent>
          </Card>
        </div>

        {/* Desktop add button */}
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
          onSubmit={async (tx) => {
            await addManualTransaction(tx);
            setShowAdd(false);
          }}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>
    </PageShell>
  );
}
