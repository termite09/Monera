"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, RefreshCw, ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { getPeriodBounds, formatCurrency, formatShortDate, roundMoney, cn } from "@/lib/utils";
import { Category, Transaction, TransactionType } from "@/types";

const TRANSACTIONS_SLIDES = [
  {
    title: "Your transactions",
    body: "Every bank transfer from your Revolut CSV appears here. Search, filter by category, or change time ranges to find what you need.",
  },
  {
    title: "Changing categories",
    body: "Tap the category label on any row to reassign it. Monera will automatically update similar transactions and remember the rule for next time.",
  },
  {
    title: "Select multiple",
    body: "Tap 'Select' to pick multiple transactions at once — useful for bulk categorisation.",
  },
];

function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const CATEGORIES: Category[] = ["Needs", "Wants", "Savings"];

type SortField = "date" | "description" | "amount" | "category";

const FILTER_KEY = "monera-tx-filters";
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
  Needs: "bg-blue-500",
  Wants: "bg-amber-500",
  Savings: "bg-emerald-500",
  Uncategorized: "bg-muted-foreground/40",
};

export default function TransactionsPage() {
  const {
    month, setMonth, transactions, settings, isLoading, txError,
    addManualTransaction, deleteManualTransaction, updateManualTransaction, bulkUpdateCategory,
    bulkExclude, bulkResetToDefault, toggleExclude, refetch,
  } = useAppData();

  const searchParams = useSearchParams();
  const [search, setSearch] = useState(() => loadFilters().search ?? "");
  const [filterCat, setFilterCat] = useState<Category | "All">(() => {
    const cat = searchParams.get("category");
    if (cat && ["Needs", "Wants", "Savings"].includes(cat)) return cat as Category;
    return loadFilters().filterCat ?? "All";
  });
  const [filterType, setFilterType] = useState<TransactionType | "all">(() => loadFilters().filterType ?? "expense");
  const handleFilterTypeChange = useCallback((v: TransactionType | "all") => {
    setFilterType(v);
    if (v === "income") setFilterCat("All");
  }, []);
  const [rangeMode, setRangeMode] = useState<"period" | "custom">(() => loadFilters().rangeMode ?? "period");
  const [customFrom, setCustomFrom] = useState(() => loadFilters().customFrom ?? "");
  const [customTo, setCustomTo] = useState(() => loadFilters().customTo ?? "");
  const [sortField, setSortField] = useState<SortField>(() => loadFilters().sortField ?? "date");
  const [sortDir, setSortDir] = useState<"desc" | "asc">(() => loadFilters().sortDir ?? "desc");
  const [showAdd, setShowAdd] = useState(false);
  const [editingTx, setEditingTx] = useState<import("@/types").Transaction | null>(null);

  // Persist filters across page navigations (sessionStorage clears on tab close)
  useEffect(() => {
    sessionStorage.setItem(FILTER_KEY, JSON.stringify({
      search, filterCat, filterType, rangeMode, customFrom, customTo, sortField, sortDir,
    } satisfies StoredFilters));
  }, [search, filterCat, filterType, rangeMode, customFrom, customTo, sortField, sortDir]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir(field === "date" ? "desc" : "asc");
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    }
  }, [sortField]);

  // Multi-select state — no explicit mode toggle; checkboxes always visible
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectMode = selected.size > 0;
  const [selectCatSheet, setSelectCatSheet] = useState(false);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const paydayOfMonth = settings.paydayOfMonth ?? 1;

  const searching = search.trim().length > 0;
  const customActive = rangeMode === "custom" && !!customFrom && !!customTo;

  const selectCustom = () => {
    setRangeMode("custom");
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
          let cmp = 0;
          if (sortField === "date") cmp = a.date > b.date ? 1 : a.date < b.date ? -1 : 0;
          else if (sortField === "description") cmp = a.description.localeCompare(b.description);
          else if (sortField === "amount") cmp = a.amount - b.amount;
          else if (sortField === "category") cmp = a.category.localeCompare(b.category);
          return sortDir === "desc" ? -cmp : cmp;
        }),
    [scopedTxs, filterType, sortField, sortDir]
  );

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

  const rangeLabel = customActive ? `${formatShortDate(customFrom)} – ${formatShortDate(customTo)}` : undefined;
  const showRefund = filterType === "expense" && refunded > 0;

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelect = () => setSelected(new Set());

  const selectedTxs = useMemo(() => filtered.filter((t) => selected.has(t.id)), [filtered, selected]);
  const selectedTotal = useMemo(() => netExpenseTotal(selectedTxs), [selectedTxs]);

  const handleBulkExclude = async () => {
    const ids = [...selected];
    setIsBulkLoading(true);
    try { await bulkExclude(ids, true); exitSelect(); }
    finally { setIsBulkLoading(false); }
  };

  const handleBulkInclude = async () => {
    const ids = [...selected];
    setIsBulkLoading(true);
    try { await bulkExclude(ids, false); exitSelect(); }
    finally { setIsBulkLoading(false); }
  };

  const handleBulkCategoryChange = async (category: Category) => {
    const ids = [...selected].filter((id) => transactions.find((t) => t.id === id)?.type !== "income");
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

        {/* Controls */}
        <TransactionFilters
          search={search}
          onSearchChange={setSearch}
          filterType={filterType}
          onFilterTypeChange={handleFilterTypeChange}
          filterCat={filterCat}
          onFilterCatChange={(v) => setFilterCat(v)}
          rangeMode={rangeMode}
          onPeriodMode={() => setRangeMode("period")}
          onCustomMode={selectCustom}
          customFrom={customFrom}
          onCustomFromChange={setCustomFrom}
          customTo={customTo}
          onCustomToChange={setCustomTo}
          searching={searching}
          onAdd={() => setShowAdd(true)}
        />

        {/* Row: Count / total */}
        <p className="text-xs text-muted-foreground">
          {filtered.length} transaction{filtered.length === 1 ? "" : "s"}
          {searching ? " · all periods" : ""}{" "}·{" "}
          <span className="font-medium text-foreground tabular-nums font-mono text-sm">
            {formatCurrency(summaryTotal)}
          </span>
          {showRefund && (
            <span className="ml-1 text-muted-foreground/70 tabular-nums font-mono">
              ({formatCurrency(grossExpense)} − {formatCurrency(refunded)} refunded)
            </span>
          )}
        </p>

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
                  <button
                    onClick={() => handleSort("date")}
                    className={cn("w-14 shrink-0 flex items-center gap-1 transition-colors", sortField === "date" ? "text-foreground" : "hover:text-foreground")}
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
                    className={cn("shrink-0 flex items-center gap-1 transition-colors", sortField === "category" ? "text-foreground" : "hover:text-foreground", filterType === "income" && "invisible pointer-events-none")}
                  >
                    Category
                    {sortField === "category"
                      ? (sortDir === "asc" ? <ArrowDown size={10} /> : <ArrowUp size={10} />)
                      : <ArrowUpDown size={10} className="opacity-40" />}
                  </button>
                  <button
                    onClick={() => handleSort("amount")}
                    className={cn("shrink-0 min-w-14 flex items-center justify-end gap-1 transition-colors", sortField === "amount" ? "text-foreground" : "hover:text-foreground")}
                  >
                    Amount
                    {sortField === "amount"
                      ? (sortDir === "asc" ? <ArrowDown size={10} /> : <ArrowUp size={10} />)
                      : <ArrowUpDown size={10} className="opacity-40" />}
                  </button>
                  <button
                    onClick={() => {
                      const allIds = filtered.map((t) => t.id);
                      const allSelected = allIds.every((id) => selected.has(id));
                      setSelected(allSelected ? new Set() : new Set(allIds));
                    }}
                    className="w-6 shrink-0 flex items-center justify-center group"
                    aria-label="Select all"
                  >
                    <div className={cn(
                      "size-4 rounded-full border-2 flex items-center justify-center transition-colors",
                      filtered.length > 0 && filtered.every((t) => selected.has(t.id))
                        ? "border-primary bg-primary"
                        : "border-input/30 group-hover:border-input"
                    )}>
                      {filtered.length > 0 && filtered.every((t) => selected.has(t.id)) && (
                        <div className="size-2 rounded-full bg-white" />
                      )}
                    </div>
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {filtered.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      transaction={tx}
                      onToggleExclude={selectMode ? undefined : toggleExclude}
                      onDelete={selectMode || tx.source !== "manual" ? undefined : deleteManualTransaction}
                      onEdit={selectMode || tx.source !== "manual" ? undefined : (id) => setEditingTx(filtered.find((t) => t.id === id) ?? null)}
                      selectMode={selectMode}
                      checked={selected.has(tx.id)}
                      onCheck={!selectMode && tx.source === "manual" ? undefined : toggleSelect}
                      showCategory={filterType !== "income"}
                    />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
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

      {/* Bulk category sheet */}
      <Sheet open={selectCatSheet} onOpenChange={setSelectCatSheet}>
        <SheetContent side="bottom" className="pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>Set Category</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => handleBulkCategoryChange(cat)}
                className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-secondary transition-colors text-left"
              >
                <span className={cn("size-2.5 rounded-full shrink-0", CAT_DOT[cat])} />
                <span className="text-sm font-medium">{cat}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Transaction">
        <AddTransactionForm
          onSubmit={async (tx) => { await addManualTransaction(tx); setShowAdd(false); }}
          onCancel={() => setShowAdd(false)}
        />
      </Modal>

      <Modal isOpen={!!editingTx} onClose={() => setEditingTx(null)} title="Edit Transaction">
        {editingTx && (
          <AddTransactionForm
            initialValues={editingTx}
            submitLabel="Save Changes"
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
