"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Search, AlertCircle, RefreshCw, ArrowDown, ArrowUp } from "lucide-react";
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
import { Category, TransactionType } from "@/types";

export default function TransactionsPage() {
  const { transactions, settings, isLoading, txError, addManualTransaction, deleteManualTransaction, updateCategory, toggleExclude, refetch } = useAppData();
  const [month, setMonth] = useState(getCurrentMonth());
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<Category | "All">("All");
  const [filterType, setFilterType] = useState<TransactionType | "all">("expense");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [showAdd, setShowAdd] = useState(false);

  const paydayOfMonth = settings.paydayOfMonth ?? 1;

  // Snap to the current period on mount and when the payday loads/changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMonth(getCurrentMonth(paydayOfMonth));
  }, [paydayOfMonth]);

  const filtered = useMemo(() => {
    const { start, end } = getPeriodBounds(month, paydayOfMonth);
    const recurringTxs = getRecurringTransactions(settings.recurringPayments ?? [], month, paydayOfMonth);
    return [...transactions, ...recurringTxs]
      .filter((t) => filterType === "all" || t.type === filterType)
      .filter((t) => { const d = new Date(t.date + "T00:00:00"); return d >= start && d <= end; })
      .filter((t) => filterCat === "All" || t.category === filterCat)
      .filter((t) => !search || t.description.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const cmp = a.date > b.date ? 1 : a.date < b.date ? -1 : 0;
        return sortDir === "desc" ? -cmp : cmp;
      });
  }, [transactions, settings.recurringPayments, month, filterCat, filterType, search, paydayOfMonth, sortDir]);

  // Totals of visible transactions, ignoring excluded ones. The headline figure
  // adapts to the type filter: spent, received, or net when showing all.
  const { summaryTotal } = useMemo(() => {
    let expense = 0;
    let income = 0;
    for (const t of filtered) {
      if (t.excluded) continue;
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    const total = filterType === "income" ? income : filterType === "all" ? income - expense : expense;
    return { summaryTotal: total };
  }, [filtered, filterType]);

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
        {/* Search on its own row on phones; the two filters share a row beneath it.
            Everything sits inline from the sm breakpoint up. */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions..."
              className="w-full h-11 pl-9 pr-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as TransactionType | "all")}
              className="flex-1 sm:flex-none h-11 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Filter by type"
            >
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
              <option value="all">All types</option>
            </select>
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value as Category | "All")}
              className="flex-1 sm:flex-none h-11 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Filter by category"
            >
              <option value="All">All</option>
              <option value="Needs">Needs</option>
              <option value="Wants">Wants</option>
              <option value="Savings">Savings</option>
              <option value="Uncategorized">Uncategorized</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length} transactions ·{" "}
            <span className="font-medium text-foreground tabular-nums font-mono">
              {formatCurrency(summaryTotal)}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
              aria-label={`Sort by date, ${sortDir === "desc" ? "newest" : "oldest"} first`}
            >
              {sortDir === "desc" ? <ArrowDown size={14} className="mr-1" /> : <ArrowUp size={14} className="mr-1" />}
              {sortDir === "desc" ? "Newest" : "Oldest"}
            </Button>
            <Button onClick={() => setShowAdd(true)} size="sm" className="hidden md:inline-flex">
              <Plus size={14} className="mr-1" />
              Add
            </Button>
          </div>
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
          onSubmit={async (tx) => { await addManualTransaction(tx); setShowAdd(false); }}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>
    </PageShell>
  );
}
