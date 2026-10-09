"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { ErrorState } from "@/components/layout/ErrorState";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/Modal";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { AddTransactionForm } from "@/components/transactions/AddTransactionForm";
import { AppTour } from "@/components/onboarding/AppTour";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppData } from "@/contexts/AppDataContext";
import { TransactionFilters } from "./_components/TransactionFilters";
import { BulkActionBar } from "./_components/BulkActionBar";
import { getRecurringTransactions, getRecurringInRange } from "@/lib/recurring";
import { netExpenseTotal } from "@/lib/finance";
import { getPeriodBounds, formatCurrency, formatShortDate, roundMoney, cn, toDateStr, cleanDescription } from "@/lib/utils";
import { Category, Transaction, TransactionType } from "@/types";

const TRANSACTIONS_SLIDES = [
  {
    title: "Everything you spent",
    body: "Every transaction from your Revolut statements, for the pay period shown at the top. Search, or filter by category to find something.",
  },
  {
    title: "Fix a category",
    body: "Tick the box on one or more rows, then choose Move to… to put them in Needs, Wants or Savings. Shift-click to tick a run of rows at once.",
  },
  {
    title: "Leave things out",
    body: "Transfers between your own accounts shouldn't count as spending. Tick them and choose Leave out — you can undo it straight away.",
  },
];

function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const CATEGORIES: Category[] = ["Needs", "Wants", "Savings"];

type SortField = "date" | "description" | "amount" | "category";

const FILTER_KEY = "monera-tx-filters";
const PAGE_SIZE = 50;
type StoredFilters = {
  search: string;
  filterCat: Category | "All";
  filterType: TransactionType | "all";
  rangeMode: "period" | "custom";
  customFrom: string;
  customTo: string;
  sortField: SortField;
  sortDir: "asc" | "desc";
};
function loadFilters(): Partial<StoredFilters> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(sessionStorage.getItem(FILTER_KEY) ?? "{}"); }
  catch { return {}; }
}

const CAT_DOT: Record<Category, string> = {
  Needs: "bg-cat-needs",
  Wants: "bg-cat-wants",
  Savings: "bg-cat-savings",
  Uncategorized: "bg-muted-foreground/40",
};

export default function TransactionsPage() {
  const {
    month, setMonth, transactions, settings, isLoading, txError,
    addManualTransaction, deleteManualTransaction, updateManualTransaction, bulkUpdateCategory, updateCategory,
    bulkExclude, bulkResetToDefault, refetch,
  } = useAppData();

  const searchParams = useSearchParams();
  const [search, setSearch] = useState(() => loadFilters().search ?? "");
  const [filterCat, setFilterCat] = useState<Category | "All">(() => {
    const cat = searchParams.get("category");
    if (cat && ["Needs", "Wants", "Savings", "Uncategorized"].includes(cat)) return cat as Category;
    return loadFilters().filterCat ?? "All";
  });
  const [filterType, setFilterType] = useState<TransactionType | "all">(() => loadFilters().filterType ?? "expense");
  const [rangeMode, setRangeMode] = useState<"period" | "custom">(() => loadFilters().rangeMode ?? "period");
  const [customFrom, setCustomFrom] = useState(() => loadFilters().customFrom ?? "");
  const [customTo, setCustomTo] = useState(() => loadFilters().customTo ?? "");
  const [sortField, setSortField] = useState<SortField>(() => loadFilters().sortField ?? "date");
  const [sortDir, setSortDir] = useState<"desc" | "asc">(() => loadFilters().sortDir ?? "desc");
  const [showAdd, setShowAdd] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Persist filters across page navigations (sessionStorage clears on tab close)
  useEffect(() => {
    const timer = setTimeout(() => {
      sessionStorage.setItem(FILTER_KEY, JSON.stringify({
        search, filterCat, filterType, rangeMode, customFrom, customTo, sortField, sortDir,
      } satisfies StoredFilters));
    }, 400);
    return () => clearTimeout(timer);
  }, [search, filterCat, filterType, rangeMode, customFrom, customTo, sortField, sortDir]);

  // Multi-select state — no explicit mode toggle; checkboxes always visible
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectMode = selected.size > 0;
  const [selectCatSheet, setSelectCatSheet] = useState(false);
  // One transaction whose category is being changed straight from its row.
  const [singleCatTx, setSingleCatTx] = useState<Transaction | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  // Anchor for shift-click range selection.
  const lastPickedRef = useRef<string | null>(null);
  // Short-lived undo for leaving transactions out / counting them again.
  const [undo, setUndo] = useState<{ ids: string[]; excluded: boolean } | null>(null);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(t);
  }, [undo]);

  const [page, setPage] = useState(1);

  // Filter change handlers that co-locate the side-effects (clear selection,
  // reset page) with the state change so no secondary effects are needed.
  const handleSearchChange = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);

  const handleFilterCatChange = useCallback((v: Category | "All") => {
    setFilterCat(v);
    setSelected(new Set());
    setPage(1);
  }, []);

  const handleFilterTypeChange = useCallback((v: TransactionType | "all") => {
    setFilterType(v);
    if (v === "income") setFilterCat("All");
    setSelected(new Set());
    setPage(1);
  }, []);

  const handlePeriodMode = useCallback(() => {
    setRangeMode("period");
    setSelected(new Set());
    setPage(1);
  }, []);

  const handleCustomFromChange = useCallback((v: string) => {
    setCustomFrom(v);
    setSelected(new Set());
    setPage(1);
  }, []);

  const handleCustomToChange = useCallback((v: string) => {
    setCustomTo(v);
    setSelected(new Set());
    setPage(1);
  }, []);

  const handleSort = useCallback((field: SortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir(field === "date" ? "desc" : "asc");
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    }
    setPage(1);
  }, [sortField]);

  const paydayOfMonth = settings.paydayOfMonth ?? 1;

  const searching = search.trim().length > 0;
  const customActive = rangeMode === "custom" && !!customFrom && !!customTo;

  const selectCustom = () => {
    setRangeMode("custom");
    setSelected(new Set());
    setPage(1);
    if (!customFrom || !customTo) {
      const { start, end } = getPeriodBounds(month, paydayOfMonth);
      setCustomFrom(toInputDate(start));
      setCustomTo(toInputDate(end));
    }
  };

  const scopedTxs = useMemo(() => {
    const payments = settings.recurringPayments ?? [];
    const currency = settings.currency ?? "EUR";

    let recurringTxs: Transaction[];
    let inRange: (t: Transaction) => boolean;

    if (searching && customActive) {
      recurringTxs = getRecurringInRange(payments, new Date(customFrom + "T00:00:00"), new Date(customTo + "T00:00:00"), paydayOfMonth, currency);
      inRange = (t) => t.date >= customFrom && t.date <= customTo;
    } else if (searching) {
      recurringTxs = getRecurringTransactions(payments, month, paydayOfMonth, currency);
      const { start, end } = getPeriodBounds(month, paydayOfMonth);
      inRange = (t) => {
        const d = new Date(t.date + "T00:00:00");
        return d >= start && d <= end;
      };
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
          let cmp = 0;
          if (sortField === "date") cmp = a.date > b.date ? 1 : a.date < b.date ? -1 : 0;
          else if (sortField === "description") cmp = a.description.localeCompare(b.description);
          else if (sortField === "amount") cmp = a.amount - b.amount;
          else if (sortField === "category") cmp = a.category.localeCompare(b.category);
          return sortDir === "desc" ? -cmp : cmp;
        }),
    [scopedTxs, filterType, sortField, sortDir]
  );

  const todayStr = useMemo(() => toDateStr(new Date()), []);

  // Recurring projections and manual entries dated in the future are still shown
  // in the list below (so upcoming bills stay visible), but they haven't actually
  // happened yet — the total only counts what has, matching every other total in
  // the app (dashboard, insights).
  const { summaryTotal, grossExpense, refunded, savingsIncluded } = useMemo(() => {
    let income = 0;
    let gross = 0;
    let saved = 0;
    const incurred = scopedTxs.filter((t) => t.date <= todayStr);
    for (const t of incurred) {
      if (t.excluded) continue;
      if (t.type === "income") income += t.amount;
      else {
        gross += t.amount;
        if (t.category === "Savings") saved += t.amount;
      }
    }
    const net = netExpenseTotal(incurred);
    // "Spent" never includes savings (same as the dashboard); savings are shown
    // beside it. Filtering to Savings itself shows what was moved to savings.
    const spentExSavings = filterCat === "Savings" ? net : roundMoney(net - saved);
    const total =
      filterType === "income" ? roundMoney(income) : filterType === "all" ? roundMoney(income - gross) : spentExSavings;
    return { summaryTotal: total, grossExpense: roundMoney(gross), refunded: roundMoney(gross - net), savingsIncluded: roundMoney(saved) };
  }, [scopedTxs, filterType, filterCat, todayStr]);

  const upcomingCount = useMemo(() => filtered.filter((t) => t.date > todayStr).length, [filtered, todayStr]);

  const rangeLabel = customActive ? `${formatShortDate(customFrom)} – ${formatShortDate(customTo)}` : undefined;
  const showRefund = filterType === "expense" && refunded > 0;

  // Selection helpers
  const toggleSelect = (id: string, range = false) => {
    const anchor = lastPickedRef.current;
    lastPickedRef.current = id;
    setSelected((prev) => {
      const next = new Set(prev);
      if (range && anchor && anchor !== id) {
        // Shift-click: tick every visible row between the last pick and this one.
        const visible = filtered.slice(0, page * PAGE_SIZE).map((t) => t.id);
        const a = visible.indexOf(anchor);
        const b = visible.indexOf(id);
        if (a !== -1 && b !== -1) {
          for (const rid of visible.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(rid);
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelect = () => setSelected(new Set());

  const selectedTxs = useMemo(() => filtered.filter((t) => selected.has(t.id)), [filtered, selected]);
  const selectedTotal = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of selectedTxs) {
      if (t.excluded) continue;
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return roundMoney(income - expense);
  }, [selectedTxs]);

  const handleBulkExclude = async () => {
    const ids = [...selected];
    setIsBulkLoading(true);
    try { await bulkExclude(ids, true); exitSelect(); setUndo({ ids, excluded: true }); }
    finally { setIsBulkLoading(false); }
  };

  const handleBulkInclude = async () => {
    const ids = [...selected];
    setIsBulkLoading(true);
    try { await bulkExclude(ids, false); exitSelect(); setUndo({ ids, excluded: false }); }
    finally { setIsBulkLoading(false); }
  };

  const handleUndo = async () => {
    if (!undo) return;
    const { ids, excluded } = undo;
    setUndo(null);
    await bulkExclude(ids, !excluded);
  };

  const handleBulkCategoryChange = async (category: Category) => {
    const ids = [...selected].filter((id) => transactions.some((t) => t.id === id && t.type !== "income"));
    exitSelect();
    setSelectCatSheet(false);
    if (ids.length > 0) await bulkUpdateCategory(ids.map((txId) => ({ txId, category })));
  };

  const handleBulkDefault = async () => {
    const ids = [...selected];
    setIsBulkLoading(true);
    try { await bulkResetToDefault(ids); exitSelect(); }
    finally { setIsBulkLoading(false); }
  };

  const hasExcluded = selectedTxs.some((t) => t.excluded);
  const hasIncluded = selectedTxs.some((t) => !t.excluded);
  const hasDefaultable = selectedTxs.some((t) => t.categorySource === "override" || t.excluded);

  return (
    <PageShell>
      <Header
        month={month}
        onMonthChange={setMonth}
        paydayOfMonth={paydayOfMonth}
        isLoading={isLoading}
        navLabel={rangeLabel}
      />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 md:max-w-none md:px-6">
        <h1 className="sr-only">Transactions</h1>
        {txError && <ErrorState message={txError} onRetry={refetch} />}

        {/* Controls */}
        <TransactionFilters
          search={search}
          onSearchChange={handleSearchChange}
          filterType={filterType}
          onFilterTypeChange={handleFilterTypeChange}
          filterCat={filterCat}
          onFilterCatChange={handleFilterCatChange}
          rangeMode={rangeMode}
          onPeriodMode={handlePeriodMode}
          onCustomMode={selectCustom}
          customFrom={customFrom}
          onCustomFromChange={handleCustomFromChange}
          customTo={customTo}
          onCustomToChange={handleCustomToChange}
          searching={searching}
          onAdd={() => setShowAdd(true)}
        />

        {/* Row: Count / total */}
        <p className="text-xs text-muted-foreground max-w-[70ch]">
          {filtered.length - upcomingCount} transaction{filtered.length - upcomingCount === 1 ? "" : "s"}
          {" "}·{" "}
          <span className="font-medium text-foreground tabular-nums font-mono text-sm">
            {formatCurrency(summaryTotal)}
          </span>
          {filterType === "expense" && filterCat !== "Savings" && " spent"}
          {showRefund && (
            <span className="ml-1 text-muted-foreground">
              (<span className="font-mono tabular-nums">{formatCurrency(grossExpense)}</span> − <span className="font-mono tabular-nums">{formatCurrency(refunded)}</span> refunded)
            </span>
          )}
          {filterType === "expense" && filterCat === "All" && savingsIncluded > 0 && (
            <span className="ml-1 text-muted-foreground">
              · plus <span className="font-mono tabular-nums">{formatCurrency(savingsIncluded)}</span> moved to savings
            </span>
          )}
          {upcomingCount > 0 && (
            <span className="ml-1 text-muted-foreground">
              ({upcomingCount} upcoming, not in this total)
            </span>
          )}
        </p>

        <Card className="overflow-hidden">
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
                <p className="text-muted-foreground text-xs mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 sm:gap-3 px-1.5 sm:px-2 py-2 border-b border-border bg-secondary/40 text-xs font-semibold uppercase sm:tracking-wider text-muted-foreground">
                  <button
                    onClick={() => handleSort("date")}
                    className={cn("w-12 sm:w-14 shrink-0 flex items-center gap-1 transition-colors", sortField === "date" ? "text-foreground" : "hover:text-foreground")}
                    aria-label={`Sort by date ${sortDir === "desc" ? "oldest" : "newest"} first`}
                  >
                    Date
                    {sortField === "date"
                      ? (sortDir === "desc" ? <ArrowDown size={10} /> : <ArrowUp size={10} />)
                      : <ArrowUpDown size={10} className="opacity-40" />}
                  </button>
                  <button
                    onClick={() => handleSort("description")}
                    className={cn("flex-1 min-w-0 flex items-center gap-1 transition-colors text-left", sortField === "description" ? "text-foreground" : "hover:text-foreground")}
                  >
                    Description
                    {sortField === "description"
                      ? (sortDir === "asc" ? <ArrowDown size={10} /> : <ArrowUp size={10} />)
                      : <ArrowUpDown size={10} className="opacity-40" />}
                  </button>
                  <button
                    onClick={() => handleSort("category")}
                    className={cn("flex shrink-0 w-15 sm:w-24 items-center gap-1 transition-colors", sortField === "category" ? "text-foreground" : "hover:text-foreground", filterType === "income" && "invisible pointer-events-none")}
                  >
                    Category
                    {sortField === "category"
                      ? (sortDir === "asc" ? <ArrowDown size={10} /> : <ArrowUp size={10} />)
                      : <ArrowUpDown size={10} className="opacity-40 hidden sm:inline" />}
                  </button>
                  <button
                    onClick={() => handleSort("amount")}
                    className={cn("shrink-0 w-18 sm:w-24 flex items-center justify-end gap-1 transition-colors", sortField === "amount" ? "text-foreground" : "hover:text-foreground")}
                  >
                    Amount
                    {sortField === "amount"
                      ? (sortDir === "asc" ? <ArrowDown size={10} /> : <ArrowUp size={10} />)
                      : <ArrowUpDown size={10} className="opacity-40" />}
                  </button>
                  <span className="w-11 sm:w-12 shrink-0 flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every((t) => selected.has(t.id))}
                      onChange={() => {
                        const allIds = filtered.map((t) => t.id);
                        const allSelected = allIds.every((id) => selected.has(id));
                        setSelected(allSelected ? new Set() : new Set(allIds));
                      }}
                      aria-label={`Select all ${filtered.length} transactions`}
                      className="size-4 cursor-pointer accent-primary"
                    />
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {filtered.slice(0, page * PAGE_SIZE).map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      transaction={tx}
                      onDelete={selectMode || tx.source !== "manual" ? undefined : deleteManualTransaction}
                      onEdit={selectMode || tx.source !== "manual" ? undefined : (id) => setEditingTx(filtered.find((t) => t.id === id) ?? null)}
                      selectMode={selectMode}
                      checked={selected.has(tx.id)}
                      onCheck={toggleSelect}
                      onCategory={setSingleCatTx}
                      showCategory={filterType !== "income"}
                    />
                  ))}
                  {filtered.length > page * PAGE_SIZE && (
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      className="w-full py-3 text-sm text-primary hover:bg-secondary/50 transition-colors"
                    >
                      Load more ({filtered.length - page * PAGE_SIZE} remaining)
                    </button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
        {selectMode && <div className="h-32 md:hidden" aria-hidden />}
      </div>

      {/* Selection action bar */}
      {selected.size > 0 && (
        <BulkActionBar
          selectedCount={selected.size}
          selectedTotal={selectedTotal}
          isBulkLoading={isBulkLoading}
          hasIncluded={hasIncluded}
          hasExcluded={hasExcluded}
          hasDefaultable={hasDefaultable}
          hasExpensesSelected={selectedTxs.some((t) => t.type !== "income")}
          onExclude={handleBulkExclude}
          onInclude={handleBulkInclude}
          onCategory={() => setSelectCatSheet(true)}
          onDefault={handleBulkDefault}
          onClear={exitSelect}
        />
      )}

      {/* Undo for leave out / count again */}
      {undo && selected.size === 0 && (
        <div className="fixed bottom-20 md:bottom-4 left-0 right-0 md:left-56 z-40 px-4" role="status" aria-live="polite">
          <div className="max-w-2xl mx-auto md:max-w-md bg-foreground text-background rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-sm flex-1">
              {undo.excluded ? "Left out" : "Counted again"}: {undo.ids.length} transaction{undo.ids.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={handleUndo}
              className="text-sm font-semibold underline underline-offset-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background"
            >
              Undo
            </button>
          </div>
        </div>
      )}

      {/* Category sheet — for the selected rows, or for one row tapped directly */}
      <Sheet
        open={selectCatSheet || !!singleCatTx}
        onOpenChange={(open) => { if (!open) { setSelectCatSheet(false); setSingleCatTx(null); } }}
      >
        <SheetContent side="bottom" className="pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>
              {singleCatTx ? `Move ${cleanDescription(singleCatTx.description)} to…` : `Move ${selected.size} to…`}
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-current={singleCatTx?.category === cat ? "true" : undefined}
                onClick={async () => {
                  if (singleCatTx) {
                    const id = singleCatTx.id;
                    setSingleCatTx(null);
                    if (singleCatTx.category !== cat) await updateCategory(id, cat);
                  } else {
                    await handleBulkCategoryChange(cat);
                  }
                }}
                className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-secondary transition-colors text-left"
              >
                <span className={cn("size-2.5 rounded-sm shrink-0", CAT_DOT[cat])} aria-hidden />
                <span className="text-sm font-medium flex-1">{cat}</span>
                {singleCatTx?.category === cat && <span className="text-xs text-muted-foreground">Current</span>}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add transaction">
        <AddTransactionForm
          onSubmit={async (tx) => { await addManualTransaction(tx); setShowAdd(false); }}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>

      <Modal isOpen={!!editingTx} onClose={() => setEditingTx(null)} title="Edit transaction">
        {editingTx && (
          <AddTransactionForm
            initialValues={editingTx}
            submitLabel="Save changes"
            onSubmit={async (updated) => {
              await updateManualTransaction(editingTx.id, updated);
              setEditingTx(null);
            }}
            onCancel={() => setEditingTx(null)}
          />
        )}
      </Modal>

      <AppTour pageKey="transactions" slides={TRANSACTIONS_SLIDES} />
    </PageShell>
  );
}
