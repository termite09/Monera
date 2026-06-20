"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/contexts/AppDataContext";
import { generateId, formatCurrency } from "@/lib/utils";
import { Category, RecurringPayment } from "@/types";
import { Trash2, Plus, Search, Pencil } from "lucide-react";

const CATEGORIES: Category[] = ["Needs", "Wants", "Savings"];
const RECURRING_PAGE_SIZE = 10;
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SELECT_CLS = "h-9 px-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function todayMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtPeriod(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("default", { month: "short", year: "numeric" });
}

function periodRangeLabel(r: RecurringPayment): string | null {
  if (!r.startMonth && !r.endMonth) return null;
  if (r.startMonth && r.endMonth) return `${fmtPeriod(r.startMonth)} – ${fmtPeriod(r.endMonth)}`;
  if (r.startMonth) return `From ${fmtPeriod(r.startMonth)}`;
  return `Until ${fmtPeriod(r.endMonth!)}`;
}

function MonthYearPicker({ value, onChange, label, id }: { value: string; onChange: (v: string) => void; label: string; id?: string }) {
  const now = new Date();
  const years = Array.from({ length: 16 }, (_, i) => now.getFullYear() - 10 + i);
  const [ym, mm] = value ? value.split("-") : ["", ""];

  const set = (newY: string, newM: string) => {
    if (!newY || !newM) { onChange(""); return; }
    onChange(`${newY}-${newM}`);
  };

  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs">{label}</Label>
      <div className="grid grid-cols-2 gap-1.5">
        <select id={id} value={mm ?? ""} onChange={(e) => set(ym || String(now.getFullYear()), e.target.value)} className={SELECT_CLS}>
          <option value="">Month</option>
          {MONTH_NAMES.map((n, i) => <option key={i} value={String(i + 1).padStart(2, "0")}>{n}</option>)}
        </select>
        <select value={ym ?? ""} onChange={(e) => set(e.target.value, mm || String(now.getMonth() + 1).padStart(2, "0"))} className={SELECT_CLS}>
          <option value="">Year</option>
          {years.map((yr) => <option key={yr} value={String(yr)}>{yr}</option>)}
        </select>
      </div>
    </div>
  );
}

export function RecurringForm({ settings, updateSettings }: {
  settings: ReturnType<typeof useAppData>["settings"];
  updateSettings: ReturnType<typeof useAppData>["updateSettings"];
}) {
  const [items, setItems] = useState<RecurringPayment[]>(settings.recurringPayments ?? []);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<RecurringPayment | null>(null);

  // Add-form state
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");
  const [category, setCategory] = useState<Category>("Needs");
  const [startMonth, setStartMonth] = useState(todayMonthKey());
  const [endMonth, setEndMonth] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  // Intentional sync from externally-loaded settings.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(settings.recurringPayments ?? []);
  }, [settings]);

  const dirty = JSON.stringify(items) !== JSON.stringify(settings.recurringPayments ?? []);

  const filtered = items.filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / RECURRING_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * RECURRING_PAGE_SIZE, currentPage * RECURRING_PAGE_SIZE);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  const addItem = () => {
    const amt = parseFloat(amount);
    const d = parseInt(day);
    if (!name.trim() || !amt || amt <= 0 || !d || d < 1 || d > 31) return;
    const next: RecurringPayment = {
      id: generateId(`rec-${name}-${Date.now()}`),
      name: name.trim(),
      amount: amt,
      dayOfMonth: Math.min(31, d),
      category,
      ...(startMonth ? { startMonth } : {}),
      ...(endMonth ? { endMonth } : {}),
    };
    setItems((prev) => [...prev, next]);
    setName(""); setAmount(""); setDay(""); setCategory("Needs");
    setStartMonth(todayMonthKey()); setEndMonth("");
  };

  const startEdit = (item: RecurringPayment) => { setEditingId(item.id); setEditDraft({ ...item }); };
  const cancelEdit = () => { setEditingId(null); setEditDraft(null); };
  const saveEdit = () => {
    if (!editDraft) return;
    setItems((prev) => prev.map((i) => (i.id === editDraft.id ? editDraft : i)));
    setEditingId(null); setEditDraft(null);
  };
  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (editingId === id) cancelEdit();
  };

  const handleSave = async () => {
    setIsSaving(true); setError(false);
    try {
      await updateSettings({ ...settings, recurringPayments: items });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch { setError(true); }
    finally { setIsSaving(false); }
  };

  const ordinal = (n: number) => {
    if (n % 10 === 1 && n !== 11) return `${n}st`;
    if (n % 10 === 2 && n !== 12) return `${n}nd`;
    if (n % 10 === 3 && n !== 13) return `${n}rd`;
    return `${n}th`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Bills</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Fixed bills paid outside Revolut — rent, insurance, subscriptions. Added automatically to each period.</p>
      </div>

      {/* Search — only shown when there are entries */}
      {items.length > 0 && (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search recurring payments…"
            className="w-full h-11 pl-9 pr-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {/* List */}
      <Card className="shadow-none border-border">
        <CardContent className="p-3 flex flex-col">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No recurring payments yet</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No matches for &quot;{search}&quot;</p>
          ) : (
            <div className="divide-y divide-border">
              {pageItems.map((item) => {
                const isEditing = editingId === item.id;
                const draft = isEditing ? editDraft! : null;

                if (isEditing && draft) {
                  return (
                    <div key={item.id} className="py-3 px-1 flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2 flex flex-col gap-1">
                          <Label className="text-xs">Name</Label>
                          <Input value={draft.name} onChange={(e) => setEditDraft((d) => d && { ...d, name: e.target.value })} className="h-9" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs">Amount (€)</Label>
                          <Input type="number" value={String(draft.amount)} onChange={(e) => setEditDraft((d) => d && { ...d, amount: parseFloat(e.target.value) || 0 })} className="h-9" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label className="text-xs">Day of month</Label>
                          <Input type="number" min={1} max={31} value={String(draft.dayOfMonth)} onChange={(e) => setEditDraft((d) => d && { ...d, dayOfMonth: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)) })} className="h-9" />
                        </div>
                        <div className="col-span-2 flex flex-col gap-1">
                          <Label className="text-xs">Category</Label>
                          <select value={draft.category} onChange={(e) => setEditDraft((d) => d && { ...d, category: e.target.value as Category })} className="h-9 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <MonthYearPicker
                          label="From period"
                          value={draft.startMonth ?? ""}
                          onChange={(v) => setEditDraft((d) => d && { ...d, startMonth: v || undefined })}
                        />
                        <MonthYearPicker
                          label="Until period (opt.)"
                          value={draft.endMonth ?? ""}
                          onChange={(v) => setEditDraft((d) => d && { ...d, endMonth: v || undefined })}
                        />
                      </div>
                      <div className="flex gap-2 items-center">
                        <Button size="sm" onClick={saveEdit} className="flex-1 h-8">Save</Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit} className="flex-1 h-8">Cancel</Button>
                        <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1.5" aria-label="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                }

                const rangeLabel = periodRangeLabel(item);
                return (
                  <div key={item.id} className="flex items-center gap-3 py-2.5 px-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ordinal(item.dayOfMonth)} · {item.category}
                        {rangeLabel && <span className="ml-1 text-muted-foreground/70">· {rangeLabel}</span>}
                      </p>
                    </div>
                    <span className="text-sm tabular-nums text-foreground font-mono">{formatCurrency(item.amount)}</span>
                    <button onClick={() => startEdit(item)} className="text-muted-foreground hover:text-foreground transition-colors p-1" aria-label={`Edit ${item.name}`}>
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1" aria-label={`Remove ${item.name}`}>
                      <Trash2 size={15} />
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
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="h-8 px-3 rounded-md border border-input disabled:opacity-40 hover:bg-secondary transition-colors"
          >
            Prev
          </button>
          <span>{currentPage} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="h-8 px-3 rounded-md border border-input disabled:opacity-40 hover:bg-secondary transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Add form */}
      <Card className="shadow-none border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Add Payment</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="r-name">Name</Label>
            <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CNP Insurance" className="h-11" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-amount">Amount (€)</Label>
              <Input id="r-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="45" className="h-11" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="r-day">Day of month</Label>
              <Input id="r-day" type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} placeholder="11" className="h-11" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="r-cat">Category</Label>
            <select
              id="r-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="h-11 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MonthYearPicker id="r-start" label="From period" value={startMonth} onChange={setStartMonth} />
            <MonthYearPicker id="r-end" label="Until period (opt.)" value={endMonth} onChange={setEndMonth} />
          </div>
          <p className="text-xs text-muted-foreground">
            Leave &quot;From period&quot; blank to apply to all periods including past ones. Leave &quot;Until&quot; blank for no end date.
          </p>
          <Button onClick={addItem} variant="outline" className="w-full">
            <Plus size={16} className="mr-1.5" />
            Add to list
          </Button>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving || !dirty} className={`w-full ${error ? "bg-destructive text-white" : "bg-primary text-primary-foreground"}`}>
        {error ? "Save failed — sign out & back in" : saved ? "✓ Saved" : isSaving ? "Saving..." : "Save Recurring Payments"}
      </Button>
    </div>
  );
}
