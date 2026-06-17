"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Search, AlertCircle, RefreshCw } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FAB } from "@/components/ui/FAB";
import { Modal } from "@/components/ui/Modal";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { AddTransactionForm } from "@/components/transactions/AddTransactionForm";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppData } from "@/contexts/AppDataContext";
import { getRecurringTransactions } from "@/lib/recurring";
import { getCurrentMonth, getPeriodBounds, formatCurrency } from "@/lib/utils";
import { Category } from "@/types";

export default function TransactionsPage() {
  const { transactions, settings, isLoading, txError, addManualTransaction, deleteManualTransaction, updateCategory, toggleExclude, refetch } = useAppData();
  const [month, setMonth] = useState(getCurrentMonth());
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<Category | "All">("All");
  const [showAdd, setShowAdd] = useState(false);

  const paydayOfMonth = settings.paydayOfMonth ?? 1;

  useEffect(() => {
    setMonth(getCurrentMonth(paydayOfMonth));
  }, [paydayOfMonth]);

  const filtered = useMemo(() => {
    const { start, end } = getPeriodBounds(month, paydayOfMonth);
    const recurringTxs = getRecurringTransactions(settings.recurringPayments ?? [], month, paydayOfMonth);
    return [...transactions, ...recurringTxs]
      .filter((t) => t.type === "expense")
      .filter((t) => { const d = new Date(t.date + "T00:00:00"); return d >= start && d <= end; })
      .filter((t) => filterCat === "All" || t.category === filterCat)
      .filter((t) => !search || t.description.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
  }, [transactions, settings.recurringPayments, month, filterCat, search, paydayOfMonth]);

  // Sum of visible transactions, ignoring excluded ones
  const total = useMemo(
    () => filtered.filter((t) => !t.excluded).reduce((s, t) => s + t.amount, 0),
    [filtered]
  );

  return (
    <PageShell>
      <Header month={month} onMonthChange={setMonth} paydayOfMonth={paydayOfMonth} isLoading={isLoading} />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4">
        {txError && (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
            <AlertCircle size={16} className="shrink-0 text-destructive" />
            <p className="flex-1 text-sm text-destructive">{txError}</p>
            <button onClick={refetch} className="flex items-center gap-1 text-xs text-destructive underline-offset-2 hover:underline">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions..."
              className="w-full h-11 pl-9 pr-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value as Category | "All")}
            className="h-11 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="All">All</option>
            <option value="Needs">Needs</option>
            <option value="Wants">Wants</option>
            <option value="Savings">Savings</option>
            <option value="Uncategorized">Uncategorized</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length} transactions ·{" "}
            <span className="font-medium text-foreground tabular-nums font-mono">
              {formatCurrency(total)}
            </span>
          </p>
          <Button onClick={() => setShowAdd(true)} size="sm" className="hidden md:inline-flex">
            <Plus size={14} className="mr-1" />
            Add
          </Button>
        </div>

        <Card className="shadow-none border-border overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground text-sm">No transactions found</p>
                <p className="text-muted-foreground/50 text-xs mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[2.8rem_1fr_auto_auto_1.75rem_1.75rem] items-center gap-2 sm:gap-3 px-2 py-2 border-b border-border bg-secondary/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Date</span>
                  <span>Description</span>
                  <span className="justify-self-start">Category</span>
                  <span className="justify-self-end">Amount</span>
                  <span />
                  <span />  {/* spacer aligns with delete column in TransactionRow */}
                </div>
                <div className="divide-y divide-border">
                  {filtered.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      transaction={tx}
                      onCategoryChange={updateCategory}
                      onToggleExclude={toggleExclude}
                      onDelete={tx.source === "manual" ? deleteManualTransaction : undefined}
                    />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
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
