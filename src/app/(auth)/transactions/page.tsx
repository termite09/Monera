"use client";

import { useState, useMemo } from "react";
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
import { getRecurringTransactions, getRecurringInRange } from "@/lib/recurring";
import { netExpenseTotal } from "@/lib/finance";
import { getPeriodBounds, formatCurrency, roundMoney, cn } from "@/lib/utils";
import { Category, Transaction, TransactionType } from "@/types";

function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shortLabel(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function TransactionsPage() {
  const { month, setMonth, transactions, settings, isLoading, txError, addManualTransaction, deleteManualTransaction, updateCategory, toggleExclude, refetch } = useAppData();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<Category | "All">("All");
  const [filterType, setFilterType] = useState<TransactionType | "all">("expense");
  const [rangeMode, setRangeMode] = useState<"period" | "custom">("period");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [showAdd, setShowAdd] = useState(false);

  const paydayOfMonth = settings.paydayOfMonth ?? 1;

  const searching = search.trim().length > 0;
  const customActive = rangeMode === "custom" && !!customFrom && !!customTo;

  // Switching to a custom range prefills the current period so the inputs start
  // somewhere sensible instead of blank.
  const selectCustom = () => {
    setRangeMode("custom");
    if (!customFrom || !customTo) {
      const { start, end } = getPeriodBounds(month, paydayOfMonth);
      setCustomFrom(toInputDate(start));
      setCustomTo(toInputDate(end));
    }
  };

  // The scope set: transactions + recurring, filtered by date range / search /
  // category but NOT by type — so refunds (income in an expense category) stay
  // available to net against. Recurring bills are generated to match the scope:
  // one period for "this period", across the range for a custom range, and
  // across full history when searching.
  const scopedTxs = useMemo(() => {
    const payments = settings.recurringPayments ?? [];
    const currency = settings.currency ?? "EUR";

    let recurringTxs: Transaction[];
    let inRange: (t: Transaction) => boolean;

    if (searching) {
      const dates = transactions.map((t) => t.date).sort();
      const earliest = dates[0] ? new Date(dates[0] + "T00:00:00") : new Date();
      recurringTxs = getRecurringInRange(payments, earliest, new Date(), paydayOfMonth, currency);
      inRange = () => true;
    } else if (customActive) {
      recurringTxs = getRecurringInRange(payments, new Date(customFrom + "T00:00:00"), new Date(customTo + "T00:00:00"), paydayOfMonth, currency);
      inRange = (t) => t.date >= customFrom && t.date <= customTo;
    } else {
      recurringTxs = getRecurringTransactions(payments, month, paydayOfMonth, currency);
      const { start, end } = getPeriodBounds(month, paydayOfMonth);
      inRange = (t) => {
        const d = new Date(t.date + "T00:00:00");
        return d >= start && d <= end;
      };
    }

    return [...transactions, ...recurringTxs]
      .filter(inRange)
      .filter((t) => filterCat === "All" || t.category === filterCat)
      .filter((t) => !searching || t.description.toLowerCase().includes(search.toLowerCase()));
  }, [transactions, settings.recurringPayments, settings.currency, month, paydayOfMonth, filterCat, search, searching, customActive, customFrom, customTo]);

  const filtered = useMemo(
    () =>
      scopedTxs
        .filter((t) => filterType === "all" || t.type === filterType)
        .sort((a, b) => {
          const cmp = a.date > b.date ? 1 : a.date < b.date ? -1 : 0;
          return sortDir === "desc" ? -cmp : cmp;
        }),
    [scopedTxs, filterType, sortDir]
  );

  // Headline total. Expenses are NET (refunds subtracted) so the figure matches
  // the dashboard and reports for the same period; income is the raw sum; "all"
  // is net cash flow (in − gross out). `refunded` reconciles the net expense
  // figure with the gross sum of the visible expense rows.
  const { summaryTotal, grossExpense, refunded } = useMemo(() => {
    let income = 0;
    let gross = 0;
    for (const t of scopedTxs) {
      if (t.excluded) continue;
      if (t.type === "income") income += t.amount;
      else gross += t.amount;
    }
    const net = netExpenseTotal(scopedTxs);
    const total =
      filterType === "income" ? roundMoney(income) : filterType === "all" ? roundMoney(income - gross) : net;
    return { summaryTotal: total, grossExpense: roundMoney(gross), refunded: roundMoney(gross - net) };
  }, [scopedTxs, filterType]);

  const rangeLabel = customActive ? `${shortLabel(customFrom)} – ${shortLabel(customTo)}` : undefined;
  const showRefund = filterType === "expense" && refunded > 0;

  return (
    <PageShell>
      <Header
        month={month}
        onMonthChange={setMonth}
        paydayOfMonth={paydayOfMonth}
        isLoading={isLoading}
        navLabel={searching ? "All periods" : rangeLabel}
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
        {/* Range selector: current payday period, or a custom from/to range */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-secondary">
            <button
              onClick={() => setRangeMode("period")}
              className={cn(
                "h-8 rounded-md text-xs font-medium transition-colors",
                rangeMode === "period" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              This period
            </button>
            <button
              onClick={selectCustom}
              className={cn(
                "h-8 rounded-md text-xs font-medium transition-colors",
                rangeMode === "custom" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Custom range
            </button>
          </div>
          {rangeMode === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                aria-label="From date"
                className="flex-1 h-11 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground shrink-0">to</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                aria-label="To date"
                className="flex-1 h-11 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
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
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              {filtered.length} transaction{filtered.length === 1 ? "" : "s"}
              {searching ? " · all periods" : customActive ? ` · ${rangeLabel}` : ""}{" "}·{" "}
              <span className="font-medium text-foreground tabular-nums font-mono">
                {formatCurrency(summaryTotal)}
              </span>
            </p>
            {showRefund && (
              <p className="text-xs text-muted-foreground/80 mt-0.5 tabular-nums font-mono">
                {formatCurrency(grossExpense)} out · {formatCurrency(refunded)} refunded
              </p>
            )}
          </div>
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
                  <span className="w-16 shrink-0">Date</span>
                  <span className="flex-1 min-w-0 truncate">Description</span>
                  <span className="w-14 sm:w-22 shrink-0">Category</span>
                  <span className="shrink-0 w-16 text-right">Amount</span>
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
