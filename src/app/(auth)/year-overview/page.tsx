"use client";

import { useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/Card";
import { YearBar } from "@/components/charts/YearBar";
import { useAuth } from "@/hooks/useAuth";
import { useDrive } from "@/hooks/useDrive";
import { useTransactions } from "@/hooks/useTransactions";
import { formatCurrency } from "@/lib/utils";

export default function YearOverviewPage() {
  const { accessToken } = useAuth();
  const { structure } = useDrive(accessToken);
  const { transactions, isLoading } = useTransactions(accessToken, structure);
  const [year, setYear] = useState(new Date().getFullYear());

  const yearTxs = transactions.filter((t) => t.date.startsWith(String(year)));
  const totalExpenses = yearTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalSavings = yearTxs.filter((t) => t.category === "Savings").reduce((s, t) => s + t.amount, 0);

  return (
    <PageShell>
      <div className="p-4 max-w-2xl mx-auto space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Year Overview</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              ‹
            </button>
            <span className="text-sm font-medium w-12 text-center">{year}</span>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              ›
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <p className="text-xs text-gray-500 mb-1">Total Expenses</p>
            <p className="text-xl font-semibold tabular-nums text-gray-900 dark:text-white">{formatCurrency(totalExpenses)}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 mb-1">Total Savings</p>
            <p className="text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(totalSavings)}</p>
          </Card>
        </div>

        <Card>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Monthly Breakdown</h2>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">Loading...</div>
          ) : (
            <YearBar transactions={yearTxs} year={year} />
          )}
        </Card>
      </div>
    </PageShell>
  );
}
