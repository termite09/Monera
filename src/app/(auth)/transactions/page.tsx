"use client";

import { useState, useMemo } from "react";
import { Plus, Search } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FAB } from "@/components/ui/FAB";
import { Modal } from "@/components/ui/Modal";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { AddTransactionForm } from "@/components/transactions/AddTransactionForm";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useDrive } from "@/hooks/useDrive";
import { useTransactions } from "@/hooks/useTransactions";
import { getCurrentMonth } from "@/lib/utils";
import { Category } from "@/types";

export default function TransactionsPage() {
  const { accessToken } = useAuth();
  const { structure } = useDrive(accessToken);
  const [month, setMonth] = useState(getCurrentMonth());
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<Category | "All">("All");
  const [showAdd, setShowAdd] = useState(false);

  const { transactions, isLoading, addManualTransaction, updateCategory } = useTransactions(accessToken, structure);

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => t.month === month)
      .filter((t) => filterCat === "All" || t.category === filterCat)
      .filter((t) => !search || t.description.toLowerCase().includes(search.toLowerCase()));
  }, [transactions, month, filterCat, search]);

  return (
    <PageShell>
      <Header month={month} onMonthChange={setMonth} />

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions..."
              className="w-full h-11 pl-9 pr-3 rounded-lg border border-gray-200 dark:border-[#2D2D2D] bg-white dark:bg-[#1A1A1A] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            />
          </div>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value as Category | "All")}
            className="h-11 px-3 rounded-lg border border-gray-200 dark:border-[#2D2D2D] bg-white dark:bg-[#1A1A1A] text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
          >
            <option value="All">All</option>
            <option value="Needs">Needs</option>
            <option value="Wants">Wants</option>
            <option value="Savings">Savings</option>
            <option value="Uncategorized">Uncategorized</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{filtered.length} transactions</p>
          {/* Desktop add button — FAB handles mobile */}
          <Button onClick={() => setShowAdd(true)} size="sm" className="hidden md:inline-flex">
            <Plus size={14} />
            Add
          </Button>
        </div>

        {/* Transaction list */}
        <Card padding="sm">
          {isLoading ? (
            <div className="space-y-3 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-400 text-sm">No transactions found</p>
              <p className="text-gray-300 dark:text-gray-600 text-xs mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  onCategoryChange={updateCategory}
                />
              ))}
            </div>
          )}
        </Card>
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
