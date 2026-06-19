"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Search, AlertCircle, RefreshCw, ArrowDown, ArrowUp } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FAB } from "@/components/ui/FAB";
import { Modal } from "@/components/ui/Modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { AddTransactionForm } from "@/components/transactions/AddTransactionForm";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppData } from "@/contexts/AppDataContext";
import { getRecurringTransactions } from "@/lib/recurring";
import { getCurrentMonth, getPeriodBounds, formatCurrency, cn } from "@/lib/utils";
import { Category, TransactionType } from "@/types";

export default function TransactionsPage() {
  const { transactions, settings, isLoading, txError, addManualTransaction, deleteManualTransaction, updateCategory, toggleExclude, refetch } = useAppData();
  const [month, setMonth] = useState(getCurrentMonth());
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<Category | "All">("All");
  const [filterType, setFilterType] = useState<TransactionType | "all">("expense");
  const [timeRange, setTimeRange] = useState<"current" | "3m" | "6m" | "all">("current");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [showAdd, setShowAdd] = useState(false);

  const paydayOfMonth = settings.paydayOfMonth ?? 1;

  // Snap to the current period on mount and when the payday loads/changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMonth(getCurrentMonth(paydayOfMonth));
  }, [paydayOfMonth]);

  const searching = search.trim().length > 0;

  const filtered = useMemo(() => {
    // Recurring transactions are synthetic for a specific period — exclude them
    // whenever the user is searching across history or viewing a multi-period range.
    const recurringTxs = !searching && timeRange === "current"
      ? getRecurringTransactions(settings.recurringPayments ?? [], month, paydayOfMonth, settings.currency ?? "EUR")
      : [];

    return [...transactions, ...recurringTxs]
      .filter((t) => filterType === "all" || t.type === filterType)
      .filter((t) => {
        if (searching) return true;
        const d = new Date(t.date + "T00:00:00");
        if (timeRange === "current") {
          const { start, end } = getPeriodBounds(month, paydayOfMonth);
          return d >= start && d <= end;
        }
        if (timeRange === "all") return true;
        const months = timeRange === "3m" ? 3 : 6;
        const now = new Date();
        const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
        return d >= cutoff;
      })
      .filter((t) => filterCat === "All" || t.category === filterCat)
      .filter((t) => !search || t.description.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const cmp = a.date > b.date ? 1 : a.date < b.date ? -1 : 0;
        return sortDir === "desc" ? -cmp : cmp;
      });
  }, [transactions, settings.recurringPayments, settings.currency, month, filterCat, filterType, search, searching, timeRange, paydayOfMonth, sortDir]);

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
      <Header
        month={month}
        onMonthChange={setMonth}
        paydayOfMonth={paydayOfMonth}
        isLoading={isLoading}
        navLabel={timeRange === "3m" ? "Last 3 months" : timeRange === "6m" ? "Last 6 months" : timeRange === "all" ? "All time" : undefined}
      />

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
        {/* Time range selector */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-secondary">
          {(["current", "3m", "6m", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={cn(
                "h-8 rounded-md text-xs font-medium transition-colors",
                timeRange === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r === "current" ? "This period" : r === "3m" ? "3 months" : r === "6m" ? "6 months" : "All time"}
            </button>
          ))}
        </div>

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
            <Select value={filterType} onValueChange={(v) => setFilterType(v as TransactionType | "all")}>
              <SelectTrigger className="flex-1 sm:flex-none h-11 sm:w-32" aria-label="Filter by type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expenses</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="all">All types</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCat} onValueChange={(v) => setFilterCat(v as Category | "All")}>
              <SelectTrigger className="flex-1 sm:flex-none h-11 sm:w-36" aria-label="Filter by category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All categories</SelectItem>
                <SelectItem value="Needs">Needs</SelectItem>
                <SelectItem value="Wants">Wants</SelectItem>
                <SelectItem value="Savings">Savings</SelectItem>
                <SelectItem value="Uncategorized">Uncategorized</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length} transaction{filtered.length === 1 ? "" : "s"}
            {searching ? " · all periods" : timeRange === "3m" ? " · 3 months" : timeRange === "6m" ? " · 6 months" : timeRange === "all" ? " · all time" : ""}{" "}·{" "}
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
                <div className="flex items-center gap-2 sm:gap-3 px-2 py-2 border-b border-border bg-secondary/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="w-20 shrink-0">Date</span>
                  <span className="flex-1 min-w-0">Description</span>
                  <span className="shrink-0">Category</span>
                  <span className="shrink-0 w-24 text-right">Amount</span>
                  {/* spacer aligns with the exclude action in each row */}
                  <span className="w-6 shrink-0" />
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
