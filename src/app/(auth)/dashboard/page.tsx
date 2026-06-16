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
import { Card } from "@/components/ui/Card";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { AddTransactionForm } from "@/components/transactions/AddTransactionForm";
import { useAuth } from "@/hooks/useAuth";
import { useDrive } from "@/hooks/useDrive";
import { useTransactions } from "@/hooks/useTransactions";
import { useBudget } from "@/hooks/useBudget";
import { getCurrentMonth, formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const { accessToken } = useAuth();
  const { structure } = useDrive(accessToken);
  const [month, setMonth] = useState(getCurrentMonth());
  const [showAdd, setShowAdd] = useState(false);

  const { transactions, isLoading, addManualTransaction, updateCategory } = useTransactions(accessToken, structure);
  const { summary, budgetAllocations } = useBudget(accessToken, structure, transactions, month);

  const monthTxs = transactions.filter((t) => t.month === month);

  const summaryCards = [
    { label: "Income", amount: summary.income, icon: "💰", colorClass: "text-emerald-600 dark:text-emerald-400" },
    { label: "Expenses", amount: summary.totalExpenses, icon: "💸", colorClass: "text-gray-900 dark:text-white" },
    { label: "Remaining", amount: summary.remaining, icon: "🏦", colorClass: summary.remaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600" },
    { label: "Savings", amount: summary.savings, icon: "📈", colorClass: "text-blue-600 dark:text-blue-400" },
  ];

  // Suppress unused variable warning
  void formatCurrency;
  void updateCategory;

  return (
    <PageShell>
      <Header month={month} onMonthChange={setMonth} />

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
            : summaryCards.map((card, i) => (
                <SummaryCard key={card.label} {...card} index={i} />
              ))}
        </div>

        {/* Budget Progress */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Budget Progress</h2>
          <div className="space-y-4">
            <BudgetBar label="Needs" spent={summary.needs} allocated={budgetAllocations.needs} colorClass="text-[#1E3A5F] dark:text-blue-400" />
            <BudgetBar label="Wants" spent={summary.wants} allocated={budgetAllocations.wants} colorClass="text-amber-600 dark:text-amber-400" />
            <BudgetBar label="Savings" spent={summary.savings} allocated={budgetAllocations.savings} colorClass="text-emerald-600 dark:text-emerald-400" />
          </div>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Spending by Category</h2>
            <SpendingPie transactions={monthTxs} />
          </Card>
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Daily Spending</h2>
            <DailyTrend transactions={monthTxs} month={month} />
          </Card>
        </div>

        {/* Quick add */}
        <div className="flex justify-end">
          <Button onClick={() => setShowAdd(true)} size="md">
            <Plus size={16} />
            Add Transaction
          </Button>
        </div>
      </div>

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
