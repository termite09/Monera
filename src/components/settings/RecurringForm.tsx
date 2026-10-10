"use client";

import { useState, useId } from "react";
import { Trash2, Plus, Search, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { generateId, formatCurrency, ordinal, getCurrentPeriodKey, getDisplayCurrency } from "@/lib/utils";
import { BUDGET_CATEGORIES, MONTH_NAMES } from "@/config/constants";
import { billPeriodLabel } from "@/lib/recurring";
import { useSaveStatus } from "@/hooks/useSaveStatus";
import { Category, RecurringPayment, Settings } from "@/types";
import { SaveButton } from "./SaveButton";

const PAGE_SIZE = 10;

function MonthYearPicker({ value, onChange, label, id }: { value: string; onChange: (v: string) => void; label: string; id?: string }) {
  const now = new Date();
  const years = Array.from({ length: 16 }, (_, i) => now.getFullYear() - 10 + i);
  const [year, month] = value ? value.split("-") : ["", ""];
  const set = (y: string, m: string) => onChange(y && m ? `${y}-${m}` : "");

  const labelId = useId();
  return (
    <div className="flex flex-col gap-1" role="group" aria-labelledby={labelId}>
      <Label id={labelId} htmlFor={id} className="text-xs">{label}</Label>
      <div className="grid grid-cols-2 gap-1.5">
        <NativeSelect id={id} aria-label="Month" value={month} onChange={(e) => set(year || String(now.getFullYear()), e.target.value)} className="h-9 px-2">
          <option value="">Month</option>
          {MONTH_NAMES.map((n, i) => <option key={n} value={String(i + 1).padStart(2, "0")}>{n}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Year" value={year} onChange={(e) => set(e.target.value, month || String(now.getMonth() + 1).padStart(2, "0"))} className="h-9 px-2">
          <option value="">Year</option>
          {years.map((yr) => <option key={yr} value={String(yr)}>{yr}</option>)}
        </NativeSelect>
      </div>
    </div>
  );
}

const validBill = (b: Pick<RecurringPayment, "name" | "amount" | "dayOfMonth" | "startMonth" | "endMonth">) =>
  b.name.trim() !== "" && b.amount > 0 && b.dayOfMonth >= 1 && b.dayOfMonth <= 31 &&
  !(b.startMonth && b.endMonth && b.startMonth > b.endMonth);

/** Bills paid from other accounts. Mount with a `key` to reset. */
export function RecurringForm({ settings, updateSettings }: {
  settings: Settings;
  updateSettings: (s: Settings) => Promise<void>;
}) {
  // A new bill starts in the pay period running today, not the calendar month.
  const currentPeriod = getCurrentPeriodKey(settings.paydayOfMonth);
  const [items, setItems] = useState(settings.recurringPayments);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editDraft, setEditDraft] = useState<RecurringPayment | null>(null);

  // Add-form state
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");
  const [category, setCategory] = useState<Category>("Needs");
  const [startMonth, setStartMonth] = useState(currentPeriod);
  const [endMonth, setEndMonth] = useState("");

  const { status, run } = useSaveStatus();
  const dirty = JSON.stringify(items) !== JSON.stringify(settings.recurringPayments);

  const filtered = items.filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleAddItem = () => {
    const next: RecurringPayment = {
      id: generateId(`rec-${name}-${Date.now()}`),
      name: name.trim(),
      amount: parseFloat(amount) || 0,
      dayOfMonth: parseInt(day, 10) || 0,
      category,
      ...(startMonth ? { startMonth } : {}),
      ...(endMonth ? { endMonth } : {}),
    };
    if (!validBill(next)) return;
    setItems((prev) => [...prev, next]);
    setName(""); setAmount(""); setDay(""); setCategory("Needs");
    setStartMonth(currentPeriod); setEndMonth("");
  };

  const saveEdit = () => {
    if (!editDraft || !validBill(editDraft)) return;
    setItems((prev) => prev.map((i) => (i.id === editDraft.id ? editDraft : i)));
    setEditDraft(null);
  };
  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (editDraft?.id === id) setEditDraft(null);
  };
  const editField = (patch: Partial<RecurringPayment>) => setEditDraft((d) => d && { ...d, ...patch });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground">Bills</h2>
        <p className="text-sm text-muted-foreground mt-0.5 max-w-[65ch]">Bills you pay from another account, like rent, insurance or the gym. Monera adds them to every pay period, so Safe to spend sets that money aside.</p>
      </div>

      {/* Search — only shown when there are entries */}
      {items.length > 0 && (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search bills…"
            aria-label="Search bills"
            className="h-11 pl-9"
          />
        </div>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-3 flex flex-col">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No bills yet</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No matches for &quot;{search}&quot;</p>
          ) : (
            <div className="divide-y divide-border">
              {pageItems.map((item) => {
                if (editDraft?.id === item.id) {
                  return (
                    <div key={item.id} className="py-3 px-1 flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2 flex flex-col gap-1">
                          <Label htmlFor={`bill-name-${item.id}`} className="text-xs">Name</Label>
                          <Input id={`bill-name-${item.id}`} value={editDraft.name} onChange={(e) => editField({ name: e.target.value })} className="h-9" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`bill-amount-${item.id}`} className="text-xs">Amount ({getDisplayCurrency().trim()})</Label>
                          <Input id={`bill-amount-${item.id}`} type="number" inputMode="decimal" value={String(editDraft.amount)} onChange={(e) => editField({ amount: parseFloat(e.target.value) || 0 })} className="h-9" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`bill-day-${item.id}`} className="text-xs">Day of month</Label>
                          <Input id={`bill-day-${item.id}`} type="number" inputMode="numeric" min={1} max={31} value={String(editDraft.dayOfMonth)} onChange={(e) => editField({ dayOfMonth: Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)) })} className="h-9" />
                        </div>
                        <div className="col-span-2 flex flex-col gap-1">
                          <Label htmlFor={`bill-cat-${item.id}`} className="text-xs">Category</Label>
                          <NativeSelect id={`bill-cat-${item.id}`} value={editDraft.category} onChange={(e) => editField({ category: e.target.value as Category })} className="h-9">
                            {BUDGET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </NativeSelect>
                        </div>
                        <MonthYearPicker label="From period" value={editDraft.startMonth ?? ""} onChange={(v) => editField({ startMonth: v || undefined })} />
                        <MonthYearPicker label="Until period (opt.)" value={editDraft.endMonth ?? ""} onChange={(v) => editField({ endMonth: v || undefined })} />
                      </div>
                      <div className="flex gap-2 items-center">
                        <Button size="sm" onClick={saveEdit} className="flex-1 h-11 sm:h-8">Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditDraft(null)} className="flex-1 h-11 sm:h-8">Cancel</Button>
                        <button type="button" onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors size-11 sm:size-8 flex items-center justify-center rounded-md" aria-label={`Delete ${item.name}`}>
                          <Trash2 size={15} aria-hidden />
                        </button>
                      </div>
                    </div>
                  );
                }

                const rangeLabel = billPeriodLabel(item);
                return (
                  <div key={item.id} className="flex items-center gap-3 py-2.5 px-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground wrap-break-word">{item.name}</p>
                      <p className="text-xs text-muted-foreground max-w-[65ch]">
                        {ordinal(item.dayOfMonth)} · {item.category}
                        {rangeLabel && ` · ${rangeLabel}`}
                      </p>
                    </div>
                    <span className="text-sm tabular-nums text-foreground font-mono">{formatCurrency(item.amount)}</span>
                    <button type="button" onClick={() => setEditDraft({ ...item })} className="text-muted-foreground hover:text-foreground transition-colors size-11 sm:size-8 flex items-center justify-center rounded-md shrink-0" aria-label={`Edit ${item.name}`}>
                      <Pencil size={15} aria-hidden />
                    </button>
                    <button type="button" onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors size-11 sm:size-8 flex items-center justify-center rounded-md shrink-0" aria-label={`Remove ${item.name}`}>
                      <Trash2 size={15} aria-hidden />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="h-11 sm:h-8 px-3 rounded-md border border-input disabled:opacity-40 hover:bg-secondary transition-colors"
          >
            Prev
          </button>
          <span>{currentPage} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="h-11 sm:h-8 px-3 rounded-md border border-input disabled:opacity-40 hover:bg-secondary transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Add form */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-lg font-semibold text-foreground">Add a bill</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="r-name">Name</Label>
            <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CNP Insurance" className="h-11" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-amount">Amount ({getDisplayCurrency().trim()})</Label>
              <Input id="r-amount" type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="45" className="h-11 font-mono tabular-nums" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-day">Day of month</Label>
              <Input id="r-day" type="number" inputMode="numeric" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} placeholder="11" className="h-11" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="r-cat">Category</Label>
            <NativeSelect id="r-cat" value={category} onChange={(e) => setCategory(e.target.value as Category)} className="h-11">
              {BUDGET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MonthYearPicker id="r-start" label="From period" value={startMonth} onChange={setStartMonth} />
            <MonthYearPicker id="r-end" label="Until period (opt.)" value={endMonth} onChange={setEndMonth} />
          </div>
          <p className="text-xs text-muted-foreground max-w-[65ch]">
            Leave &quot;From period&quot; blank to apply to all periods including past ones. Leave &quot;Until&quot; blank for no end date.
          </p>
          <Button onClick={handleAddItem} variant="outline" className="w-full">
            <Plus size={16} className="mr-1.5" aria-hidden />
            Add to list
          </Button>
        </CardContent>
      </Card>

      <SaveButton status={status} onClick={() => run(() => updateSettings({ ...settings, recurringPayments: items }))} disabled={!dirty} label="Save bills" />
    </div>
  );
}
