"use client";

import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { ErrorState } from "@/components/layout/ErrorState";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/Modal";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { AppTour } from "@/components/onboarding/AppTour";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppData } from "@/contexts/AppDataContext";
import { useToday } from "@/hooks/useToday";
import { TransactionFilters, type ListType, type RangeMode, type CategoryFilter } from "./_components/TransactionFilters";
import { BulkActionBar } from "./_components/BulkActionBar";
import { getRecurringTransactions, getRecurringInRange } from "@/lib/recurring";
import { netExpenseTotal } from "@/lib/finance";
import {
  getPeriodRange, inRange, parseDateStr, formatCurrency, formatShortDate, roundMoney, cn, cleanDescription,
  getCategorySwatchClass, plural,
} from "@/lib/utils";
import { BUDGET_CATEGORIES } from "@/config/constants";
import { Category, Transaction } from "@/types";

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

type SortField = "date" | "description" | "amount" | "category";
type SortDir = "asc" | "desc";

const FILTER_KEY = "monera-tx-filters";
const PAGE_SIZE = 50;

interface Filters {
  search: string;
  category: CategoryFilter;
  listType: ListType;
  rangeMode: RangeMode;
  customFrom: string;
  customTo: string;
  sortField: SortField;
  sortDir: SortDir;
}

const DEFAULT_FILTERS: Filters = {
  search: "", category: "All", listType: "expense", rangeMode: "period",
  customFrom: "", customTo: "", sortField: "date", sortDir: "desc",
};

/** Filters from this tab's last visit, overridden by a ?category= link from the dashboard. */
function initialFilters(categoryParam: string | null): Filters {
  let stored: Partial<Filters> = {};
  try { stored = JSON.parse(sessionStorage.getItem(FILTER_KEY) ?? "{}"); } catch { /* none saved */ }
  const filters = { ...DEFAULT_FILTERS, ...stored };
  if (categoryParam === "Savings") return { ...filters, listType: "savings", category: "All" };
  if (categoryParam === "Needs" || categoryParam === "Wants" || categoryParam === "Uncategorized") {
    return { ...filters, listType: "expense", category: categoryParam };
  }
  return filters;
}

/** Expenses and Savings are kept apart: moving money to savings isn't spending. */
function inList(t: Transaction, list: ListType): boolean {
  if (list === "all") return true;
  if (list === "income") return t.type === "income";
  if (t.type === "income") return false;
  return list === "savings" ? t.category === "Savings" : t.category !== "Savings";
}

const compareBy: Record<SortField, (a: Transaction, b: Transaction) => number> = {
  date: (a, b) => a.date.localeCompare(b.date),
  description: (a, b) => a.description.localeCompare(b.description),
  amount: (a, b) => a.amount - b.amount,
  category: (a, b) => a.category.localeCompare(b.category),
};

const SORT_LABELS: Record<SortField, string> = { date: "Date", description: "Description", amount: "Amount", category: "Category" };

/** Excel runs cells starting with these as formulas; a leading apostrophe makes them plain text. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function SortHeader({ field, sort, onSort, className }: {
  field: SortField;
  sort: { field: SortField; dir: SortDir };
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const active = sort.field === field;
  const Icon = !active ? ArrowUpDown : sort.dir === "desc" ? ArrowDown : ArrowUp;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      aria-label={`Sort by ${SORT_LABELS[field].toLowerCase()}${active ? `, ${sort.dir === "asc" ? "ascending" : "descending"}` : ""}`}
      className={cn("tap-area flex items-center gap-1 transition-colors", active ? "text-foreground" : "hover:text-foreground", className)}
    >
      {SORT_LABELS[field]}
      <Icon size={10} className={active ? undefined : "opacity-40"} aria-hidden />
    </button>
  );
}

export default function TransactionsPage() {
  const {
    periodKey, setPeriodKey, transactions, settings, currency, isLoading, txError,
    addManualTransaction, deleteManualTransaction, updateManualTransaction, bulkUpdateCategory, updateCategory,
    bulkExclude, bulkResetToDefault, refetch,
  } = useAppData();
  const { paydayOfMonth } = settings;
  const today = useToday();

  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(() => initialFilters(searchParams.get("category")));
  const { search, category, listType, rangeMode, customFrom, customTo, sortField, sortDir } = filters;
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectMode = selected.size > 0;

  // Persist filters across page navigations (sessionStorage clears on tab close).
  useEffect(() => {
    const timer = setTimeout(() => {
      try { sessionStorage.setItem(FILTER_KEY, JSON.stringify(filters)); } catch { /* storage blocked */ }
    }, 400);
    return () => clearTimeout(timer);
  }, [filters]);

  /** Changes filters and starts the list over: first page, nothing ticked. */
  const changeFilters = useCallback((patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setSelected(new Set());
    setPage(1);
  }, []);

  const [showAdd, setShowAdd] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectCatSheet, setSelectCatSheet] = useState(false);
  // One transaction whose category is being changed straight from its row.
  const [singleCatTx, setSingleCatTx] = useState<Transaction | null>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  // Anchor for shift-click range selection.
  const lastPickedRef = useRef<string | null>(null);
  // Short-lived undo for any change made here: leave out, count again, move
  // category, delete. `run` puts things back as they were.
  const [undo, setUndo] = useState<{ message: string; run: () => Promise<void> } | null>(null);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(t);
  }, [undo]);

  const customActive = rangeMode === "custom" && !!customFrom && !!customTo;
  const searching = search.trim().length > 0;

  const handleSort = useCallback((field: SortField) => {
    setFilters((f) => ({
      ...f,
      sortField: field,
      sortDir: f.sortField !== field ? (field === "date" ? "desc" : "asc") : f.sortDir === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  }, []);

  const handleRangeMode = (mode: RangeMode) => {
    // Starting a custom range pre-fills it with the period on screen.
    const range = getPeriodRange(periodKey, paydayOfMonth);
    changeFilters(
      mode === "custom" && (!customFrom || !customTo)
        ? { rangeMode: mode, customFrom: range.from, customTo: range.to }
        : { rangeMode: mode }
    );
  };

  // Everything in the chosen dates (a custom range, or the pay period on screen),
  // with that span's recurring bills, narrowed by category and search.
  const scopedTxs = useMemo(() => {
    const range = customActive ? { from: customFrom, to: customTo } : getPeriodRange(periodKey, paydayOfMonth);
    const bills = customActive
      ? getRecurringInRange(settings.recurringPayments, parseDateStr(customFrom), parseDateStr(customTo), paydayOfMonth, currency)
      : getRecurringTransactions(settings.recurringPayments, periodKey, paydayOfMonth, currency);
    const query = search.trim().toLowerCase();
    return [...transactions, ...bills].filter(
      (t) =>
        inRange(t.date, range) &&
        (category === "All" || t.category === category) &&
        (!query || t.description.toLowerCase().includes(query))
    );
  }, [transactions, settings.recurringPayments, currency, periodKey, paydayOfMonth, category, search, customActive, customFrom, customTo]);

  const filtered = useMemo(() => {
    const compare = compareBy[sortField];
    return scopedTxs
      .filter((t) => inList(t, listType))
      .sort((a, b) => (sortDir === "desc" ? -compare(a, b) : compare(a, b)));
  }, [scopedTxs, listType, sortField, sortDir]);

  // Recurring projections and manual entries dated in the future are still shown
  // in the list (so upcoming bills stay visible), but they haven't happened yet —
  // the total only counts what has, matching every other total in the app.
  const { summaryTotal, grossExpense, refunded, upcomingCount } = useMemo(() => {
    let income = 0;
    let gross = 0;
    const incurred = filtered.filter((t) => t.date <= today);
    for (const t of incurred) {
      if (t.excluded) continue;
      if (t.type === "income") income += t.amount;
      else gross += t.amount;
    }
    const net = netExpenseTotal(incurred);
    const total = listType === "income" ? income : listType === "all" ? income - gross : net;
    return {
      summaryTotal: roundMoney(total),
      grossExpense: roundMoney(gross),
      refunded: roundMoney(gross - net),
      upcomingCount: filtered.length - incurred.length,
    };
  }, [filtered, listType, today]);

  const rangeLabel = customActive ? `${formatShortDate(customFrom)} – ${formatShortDate(customTo)}` : undefined;
  const showRefund = listType === "expense" && refunded > 0;
  const visibleRows = filtered.slice(0, page * PAGE_SIZE);

  // Row callbacks read the latest list through refs, so they can stay stable and
  // ticking one row doesn't re-render all the others.
  const visibleIdsRef = useRef<string[]>([]);
  const transactionsRef = useRef(transactions);
  useLayoutEffect(() => {
    visibleIdsRef.current = visibleRows.map((t) => t.id);
    transactionsRef.current = transactions;
  });

  const toggleSelect = useCallback((id: string, range = false) => {
    const anchor = lastPickedRef.current;
    lastPickedRef.current = id;
    setSelected((prev) => {
      const next = new Set(prev);
      if (range && anchor && anchor !== id) {
        // Shift-click: tick every visible row between the last pick and this one.
        const visible = visibleIdsRef.current;
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
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const selectedTxs = useMemo(() => filtered.filter((t) => selected.has(t.id)), [filtered, selected]);
  const selectedTotal = useMemo(
    () => roundMoney(selectedTxs.reduce((s, t) => (t.excluded ? s : s + (t.type === "income" ? t.amount : -t.amount)), 0)),
    [selectedTxs]
  );

  /** Runs a change to the ticked rows with the action bar showing progress, then offers an undo. */
  const runBulk = async (action: () => Promise<void>, undoMessage?: string, undoRun?: () => Promise<void>) => {
    setIsBulkLoading(true);
    try {
      await action();
      clearSelection();
      if (undoMessage && undoRun) setUndo({ message: undoMessage, run: undoRun });
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkExclude = (exclude: boolean) => {
    const ids = [...selected];
    runBulk(
      () => bulkExclude(ids, exclude),
      `${exclude ? "Left out" : "Counted"} ${plural(ids.length, "transaction")}${exclude ? "" : " again"}`,
      () => bulkExclude(ids, !exclude)
    );
  };

  const handleBulkDefault = () => {
    const ids = [...selected];
    runBulk(() => bulkResetToDefault(ids));
  };

  const handleUndo = async () => {
    if (!undo) return;
    const { run } = undo;
    setUndo(null);
    await run();
  };

  const handleBulkCategoryChange = async (cat: Category) => {
    const moved = transactions.filter((t) => selected.has(t.id) && t.type !== "income");
    clearSelection();
    setSelectCatSheet(false);
    if (moved.length === 0) return;
    const before = moved.map((t) => ({ txId: t.id, category: t.category }));
    await bulkUpdateCategory(moved.map((t) => ({ txId: t.id, category: cat })));
    setUndo({ message: `Moved ${moved.length} to ${cat}`, run: () => bulkUpdateCategory(before) });
  };

  const handleSingleCategory = async (tx: Transaction, cat: Category) => {
    setSingleCatTx(null);
    if (tx.category === cat) return;
    const before = tx.category;
    await updateCategory(tx.id, cat);
    setUndo({ message: `Moved ${cleanDescription(tx.description)} to ${cat}`, run: () => updateCategory(tx.id, before) });
  };

  const handleDelete = useCallback(async (id: string) => {
    const tx = transactionsRef.current.find((t) => t.id === id);
    await deleteManualTransaction(id);
    if (!tx) return;
    const { date, description, amount, type, currency: txCurrency, category: cat, notes, excluded } = tx;
    setUndo({
      message: `Deleted ${cleanDescription(description)}`,
      run: () => addManualTransaction({ date, description, amount, type, currency: txCurrency, category: cat, notes, excluded }),
    });
  }, [deleteManualTransaction, addManualTransaction]);

  const handleEdit = useCallback((id: string) => {
    setEditingTx(transactionsRef.current.find((t) => t.id === id) ?? null);
  }, []);

  // Download what's on screen (things that have happened) as a CSV file.
  const exportCsv = () => {
    const rows = filtered.filter((t) => t.date <= today);
    const lines = [
      "Date,Description,Category,Amount,Notes,Left out",
      ...rows.map((t) => [
        t.date,
        csvCell(cleanDescription(t.description)),
        t.type === "income" ? "Income" : t.category,
        (t.type === "income" ? t.amount : -t.amount).toFixed(2),
        csvCell(t.notes ?? ""),
        t.excluded ? "yes" : "",
      ].join(",")),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `monera-transactions-${customActive ? `${customFrom}-to-${customTo}` : periodKey}.csv`;
    a.click();
    // Revoking straight away can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Keyboard: "/" jumps to search, Esc clears a selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      // Only text entry swallows the shortcuts — a ticked checkbox keeps focus, and Esc should still clear.
      const typing = el && (
        (el instanceof HTMLInputElement && !["checkbox", "radio", "button"].includes(el.type)) ||
        el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable
      );
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        document.getElementById("tx-search")?.focus();
      } else if (e.key === "Escape") {
        clearSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection]);

  const allSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.id));
  const sort = { field: sortField, dir: sortDir };
  const incurredCount = filtered.length - upcomingCount;

  return (
    <PageShell>
      <Header
        periodKey={periodKey}
        onPeriodChange={setPeriodKey}
        paydayOfMonth={paydayOfMonth}
        isLoading={isLoading}
        navLabel={rangeLabel}
      />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-4 md:max-w-none md:px-6">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">Transactions</h1>
        {txError && <ErrorState message={txError} onRetry={refetch} />}

        <TransactionFilters
          search={search}
          onSearchChange={(v) => { setFilters((f) => ({ ...f, search: v })); setPage(1); }}
          listType={listType}
          onListTypeChange={(v) => changeFilters(v === "income" || v === "savings" ? { listType: v, category: "All" } : { listType: v })}
          category={category}
          onCategoryChange={(v) => changeFilters({ category: v })}
          rangeMode={rangeMode}
          onRangeModeChange={handleRangeMode}
          customFrom={customFrom}
          onCustomFromChange={(v) => changeFilters({ customFrom: v })}
          customTo={customTo}
          onCustomToChange={(v) => changeFilters({ customTo: v })}
          onAdd={() => setShowAdd(true)}
        />

        {/* Count, total and export */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-xs text-muted-foreground max-w-[70ch] flex-1 min-w-0 inline-flex flex-wrap items-center gap-x-1">
            {plural(incurredCount, "transaction")}
            {" "}·{" "}
            <span className="font-medium text-foreground tabular-nums font-mono text-sm">{formatCurrency(summaryTotal)}</span>
            {showRefund && (
              <span className="ml-1 text-muted-foreground">
                (<span className="font-mono tabular-nums">{formatCurrency(grossExpense)}</span> − <span className="font-mono tabular-nums">{formatCurrency(refunded)}</span> refunded)
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            aria-label="Export CSV"
            title="Export CSV"
            className="ml-auto inline-flex items-center justify-center gap-1.5 size-11 sm:size-auto sm:min-h-9 sm:px-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            <Download size={16} aria-hidden /><span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>

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
                <p className="text-muted-foreground text-xs mt-1">{searching ? "Try a different search" : "Try adjusting your filters"}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 sm:gap-3 px-1.5 sm:px-2 py-2 border-b border-border bg-secondary/40 text-xs font-semibold uppercase sm:tracking-wider text-muted-foreground">
                  <SortHeader field="date" sort={sort} onSort={handleSort} className="w-12 sm:w-14 shrink-0" />
                  <SortHeader field="description" sort={sort} onSort={handleSort} className="flex-1 min-w-0 text-left" />
                  <SortHeader field="category" sort={sort} onSort={handleSort} className={cn("w-15 sm:w-24 shrink-0", listType === "income" && "invisible pointer-events-none")} />
                  <SortHeader field="amount" sort={sort} onSort={handleSort} className="w-18 sm:w-24 shrink-0 justify-end" />
                  <label className="w-11 sm:w-12 min-h-11 -my-3 shrink-0 flex items-center justify-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(filtered.map((t) => t.id)))}
                      aria-label={`Select all ${filtered.length} transactions`}
                      className="size-4 cursor-pointer accent-primary"
                    />
                  </label>
                </div>
                <div className="divide-y divide-border">
                  {visibleRows.map((tx) => {
                    const editable = !selectMode && tx.source === "manual";
                    return (
                      <TransactionRow
                        key={tx.id}
                        transaction={tx}
                        today={today}
                        onDelete={editable ? handleDelete : undefined}
                        onEdit={editable ? handleEdit : undefined}
                        selectMode={selectMode}
                        checked={selected.has(tx.id)}
                        onCheck={toggleSelect}
                        onCategory={setSingleCatTx}
                        showCategory={listType !== "income"}
                      />
                    );
                  })}
                  {filtered.length > visibleRows.length && (
                    <button type="button"
                      onClick={() => setPage((p) => p + 1)}
                      className="w-full py-3 text-sm text-primary hover:bg-secondary/50 transition-colors"
                    >
                      Load more ({filtered.length - visibleRows.length} remaining)
                    </button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
        {selectMode && <div className="h-32 md:hidden" aria-hidden />}
      </div>

      {selectMode && (
        <BulkActionBar
          selectedCount={selected.size}
          selectedTotal={selectedTotal}
          isBulkLoading={isBulkLoading}
          hasIncluded={selectedTxs.some((t) => !t.excluded)}
          hasExcluded={selectedTxs.some((t) => t.excluded)}
          hasDefaultable={selectedTxs.some((t) => t.categorySource === "override" || t.excluded)}
          hasExpensesSelected={selectedTxs.some((t) => t.type !== "income")}
          onExclude={() => handleBulkExclude(true)}
          onInclude={() => handleBulkExclude(false)}
          onCategory={() => setSelectCatSheet(true)}
          onDefault={handleBulkDefault}
          onClear={clearSelection}
        />
      )}

      {/* Undo for the last change */}
      {undo && !selectMode && (
        <div className="fixed bottom-20 md:bottom-4 left-0 right-0 md:left-56 z-40 px-4" role="status" aria-live="polite">
          <div className="max-w-2xl mx-auto md:max-w-md bg-foreground text-background rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-sm flex-1">{undo.message}</span>
            <button
              type="button"
              onClick={handleUndo}
              className="tap-area text-sm font-semibold underline underline-offset-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background"
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
            {BUDGET_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-current={singleCatTx?.category === cat ? "true" : undefined}
                onClick={() => (singleCatTx ? handleSingleCategory(singleCatTx, cat) : handleBulkCategoryChange(cat))}
                className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-secondary transition-colors text-left"
              >
                <span className={cn("size-2.5 rounded-sm shrink-0", getCategorySwatchClass(cat))} aria-hidden />
                <span className="text-sm font-medium flex-1">{cat}</span>
                {singleCatTx?.category === cat && <span className="text-xs text-muted-foreground">Current</span>}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add transaction">
        <TransactionForm
          currency={currency}
          onSubmit={async (tx) => { await addManualTransaction(tx); setShowAdd(false); }}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>

      <Modal isOpen={!!editingTx} onClose={() => setEditingTx(null)} title="Edit transaction">
        {editingTx && (
          <TransactionForm
            currency={editingTx.currency}
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
