"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAppData } from "@/contexts/AppDataContext";
import { getMonthLabel, generateId, formatCurrency, cn } from "@/lib/utils";
import { Category, RecurringPayment, CategoryRule } from "@/types";
import { DEFAULT_CATEGORY_RULES } from "@/config/categories";
import { Trash2, Plus, Search, X, Pencil } from "lucide-react";

function MonthForm({ month, settings, paydayOfMonth, updateSettings }: {
  month: string;
  settings: ReturnType<typeof useAppData>["settings"];
  paydayOfMonth: number;
  updateSettings: ReturnType<typeof useAppData>["updateSettings"];
}) {
  const hasCustom = !!settings.monthlyBudgets[month];
  const monthBudget = settings.monthlyBudgets[month];
  const rule = monthBudget?.budgetRule ?? settings.defaultBudgetRule;

  const [income, setIncome] = useState(String(monthBudget?.income ?? ""));
  const [needs, setNeeds] = useState(String(rule.needs));
  const [wants, setWants] = useState(String(rule.wants));
  const [saving, setSaving] = useState(String(rule.savings));
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  // Reset editable fields when the selected month or the settings loaded from Drive
  // change — an intentional sync from external state, not a render-cascade bug.
  useEffect(() => {
    const mb = settings.monthlyBudgets[month];
    const r = mb?.budgetRule ?? settings.defaultBudgetRule;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIncome(String(mb?.income ?? ""));
    setNeeds(String(r.needs));
    setWants(String(r.wants));
    setSaving(String(r.savings));
  }, [month, settings]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(false);
    try {
      await updateSettings({
        ...settings,
        monthlyBudgets: {
          ...settings.monthlyBudgets,
          [month]: {
            month,
            income: parseFloat(income) || 0,
            budgetRule: {
              needs: parseFloat(needs) || 0,
              wants: parseFloat(wants) || 0,
              savings: parseFloat(saving) || 0,
            },
          },
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyDefaults = () => {
    const r = settings.defaultBudgetRule;
    setNeeds(String(r.needs));
    setWants(String(r.wants));
    setSaving(String(r.savings));
  };

  const total = (parseFloat(needs) || 0) + (parseFloat(wants) || 0) + (parseFloat(saving) || 0);
  const label = getMonthLabel(month, paydayOfMonth);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Budget Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
        </div>
        {hasCustom ? (
          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300 dark:border-emerald-800">Custom</Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground">Using defaults</Badge>
        )}
      </div>

      <Card className="shadow-none border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Planned Income</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-1.5">
          <Label htmlFor="income">Amount (€)</Label>
          <Input id="income" type="number" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="e.g. 2200" className="h-11" />
          <p className="text-xs text-muted-foreground">
            Your expected income for this period. Leave blank to use the income detected in your statement. Drives the budget split and remaining balance.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-none border-border">
        <CardHeader className="pb-3 pt-4 px-4 flex-row items-center justify-between">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Budget Split (%)</CardTitle>
          {!hasCustom && (
            <button onClick={handleCopyDefaults} className="text-xs text-primary hover:underline">
              Copy defaults
            </button>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="needs">Needs %</Label>
            <Input id="needs" type="number" value={needs} onChange={(e) => setNeeds(e.target.value)} placeholder="30" className="h-11" />
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wants">Wants %</Label>
            <Input id="wants" type="number" value={wants} onChange={(e) => setWants(e.target.value)} placeholder="60" className="h-11" />
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="savings-pct">Savings %</Label>
            <Input id="savings-pct" type="number" value={saving} onChange={(e) => setSaving(e.target.value)} placeholder="10" className="h-11" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total: <span className={total !== 100 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-emerald-600 dark:text-emerald-400 font-medium"}>{total}%</span>
            {total !== 100 && <span className="ml-1">— should equal 100%</span>}
          </p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving} className={`w-full ${error ? "bg-destructive text-white" : "bg-primary text-primary-foreground"}`}>
        {error ? "Save failed — sign out & back in" : saved ? "✓ Saved" : isSaving ? "Saving..." : `Save for ${label}`}
      </Button>
    </div>
  );
}

function GlobalForm({ settings, updateSettings }: {
  settings: ReturnType<typeof useAppData>["settings"];
  updateSettings: ReturnType<typeof useAppData>["updateSettings"];
}) {
  const [payday, setPayday] = useState(String(settings.paydayOfMonth ?? 1));
  const [needs, setNeeds] = useState(String(settings.defaultBudgetRule.needs));
  const [wants, setWants] = useState(String(settings.defaultBudgetRule.wants));
  const [saving, setSaving] = useState(String(settings.defaultBudgetRule.savings));
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  // Intentional sync from externally-loaded settings.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPayday(String(settings.paydayOfMonth ?? 1));
    setNeeds(String(settings.defaultBudgetRule.needs));
    setWants(String(settings.defaultBudgetRule.wants));
    setSaving(String(settings.defaultBudgetRule.savings));
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(false);
    const paydayNum = Math.min(28, Math.max(1, parseInt(payday) || 1));
    try {
      await updateSettings({
        ...settings,
        paydayOfMonth: paydayNum,
        defaultBudgetRule: {
          needs: parseFloat(needs) || 0,
          wants: parseFloat(wants) || 0,
          savings: parseFloat(saving) || 0,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(true);
    } finally {
      setIsSaving(false);
    }
  };

  const paydayNum = parseInt(payday) || 1;
  const ordinal = paydayNum === 1 ? "st" : paydayNum === 2 ? "nd" : paydayNum === 3 ? "rd" : "th";
  const total = (parseFloat(needs) || 0) + (parseFloat(wants) || 0) + (parseFloat(saving) || 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Global Defaults</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Applied to months without custom settings</p>
      </div>

      <Card className="shadow-none border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pay Cycle</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-1.5">
          <Label htmlFor="payday">Payday (day of month)</Label>
          <Input id="payday" type="number" min={1} max={28} value={payday} onChange={(e) => setPayday(e.target.value)} placeholder="e.g. 24" className="h-11" />
          <p className="text-xs text-muted-foreground">
            Period starts on the {paydayNum}{ordinal}. Capped at 28 for shorter months.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-none border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Default Budget Split (%)</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-needs">Needs %</Label>
            <Input id="d-needs" type="number" value={needs} onChange={(e) => setNeeds(e.target.value)} placeholder="30" className="h-11" />
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-wants">Wants %</Label>
            <Input id="d-wants" type="number" value={wants} onChange={(e) => setWants(e.target.value)} placeholder="60" className="h-11" />
          </div>
          <Separator />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="d-savings">Savings %</Label>
            <Input id="d-savings" type="number" value={saving} onChange={(e) => setSaving(e.target.value)} placeholder="10" className="h-11" />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total: <span className={total !== 100 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-emerald-600 dark:text-emerald-400 font-medium"}>{total}%</span>
            {total !== 100 && <span className="ml-1">— should equal 100%</span>}
          </p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving} className={`w-full ${error ? "bg-destructive text-white" : "bg-primary text-primary-foreground"}`}>
        {error ? "Save failed — sign out & back in" : saved ? "✓ Saved" : isSaving ? "Saving..." : "Save Defaults"}
      </Button>
    </div>
  );
}

const CATEGORIES: Category[] = ["Needs", "Wants", "Savings"];
const RECURRING_PAGE_SIZE = 10;
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function todayMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const SELECT_CLS = "h-9 px-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

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

function RecurringForm({ settings, updateSettings }: {
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
        <h2 className="text-base font-semibold text-foreground">Recurring Payments</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Fixed bills paid outside Revolut — counted automatically each period</p>
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

function RulesForm({ rules, updateRules }: {
  rules: CategoryRule[];
  updateRules: ReturnType<typeof useAppData>["updateRules"];
}) {
  const [items, setItems] = useState<CategoryRule[]>(rules);
  const [search, setSearch] = useState("");
  const [newKw, setNewKw] = useState("");
  const [newCat, setNewCat] = useState<Category>("Wants");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  // Intentional sync from externally-loaded rules.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setItems(rules), [rules]);

  const dirty = JSON.stringify(items) !== JSON.stringify(rules);

  const addRule = () => {
    const kw = newKw.trim().toLowerCase();
    if (!kw) return;
    setItems((prev) => [{ keyword: kw, category: newCat }, ...prev]);
    setNewKw("");
    setNewCat("Wants");
  };
  const setRuleCat = (i: number, category: Category) =>
    setItems((prev) => prev.map((r, idx) => (idx === i ? { ...r, category } : r)));
  const setRuleKeyword = (i: number, keyword: string) =>
    setItems((prev) => prev.map((r, idx) => (idx === i ? { ...r, keyword } : r)));
  const removeRule = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setIsSaving(true);
    setError(false);
    try {
      await updateRules(items);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(true);
    } finally {
      setIsSaving(false);
    }
  };

  const visible = items
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !search || r.keyword.includes(search.toLowerCase()));

  const catColor: Record<string, string> = {
    Needs: "text-blue-600 dark:text-blue-400",
    Wants: "text-amber-600 dark:text-amber-400",
    Savings: "text-emerald-600 dark:text-emerald-400",
    Uncategorized: "text-muted-foreground",
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Category Mappings</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          When a transaction description contains a keyword, it gets that category. Top match wins.
        </p>
      </div>

      {/* Add new */}
      <Card className="shadow-none border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Add Mapping</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-kw">Keyword (in description)</Label>
            <Input
              id="rule-kw"
              value={newKw}
              onChange={(e) => setNewKw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRule()}
              placeholder="e.g. netflix"
              className="h-11"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-cat">Category</Label>
            <select
              id="rule-cat"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value as Category)}
              className="h-11 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <Button onClick={addRule} variant="outline" className="w-full">
            <Plus size={16} className="mr-1.5" />
            Add mapping
          </Button>
        </CardContent>
      </Card>

      {/* Search + list */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search mappings..."
          className="w-full h-11 pl-9 pr-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <p className="text-xs text-muted-foreground">{visible.length} of {items.length} mappings</p>

      <Card className="shadow-none border-border overflow-hidden">
        <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
          <div className="divide-y divide-border">
            {visible.map(({ r, i }) => (
              <div key={i} className="flex items-center gap-2 py-2 px-3">
                <input
                  value={r.keyword}
                  onChange={(e) => setRuleKeyword(i, e.target.value)}
                  className="flex-1 min-w-0 h-8 px-2 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <select
                  value={r.category}
                  onChange={(e) => setRuleCat(i, e.target.value as Category)}
                  className={cn("h-8 px-2 rounded-md border border-input bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring", catColor[r.category])}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button
                  onClick={() => removeRule(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0"
                  aria-label={`Remove ${r.keyword}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button
          onClick={() => setItems(DEFAULT_CATEGORY_RULES)}
          variant="outline"
          className="flex-1"
        >
          Reset to defaults
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || !dirty}
          className={cn("flex-1", error ? "bg-destructive text-white" : "bg-primary text-primary-foreground")}
        >
          {error ? "Save failed" : saved ? "✓ Saved" : isSaving ? "Saving..." : "Save Mappings"}
        </Button>
      </div>
    </div>
  );
}

function KeywordEditor({ label, hint, placeholder, keywords, onChange }: {
  label: string;
  hint: string;
  placeholder: string;
  keywords: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const kw = draft.trim().toLowerCase();
    if (!kw || keywords.includes(kw)) {
      setDraft("");
      return;
    }
    onChange([...keywords, kw]);
    setDraft("");
  };

  return (
    <Card className="shadow-none border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{hint}</p>
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw) => (
              <Badge key={kw} variant="secondary" className="gap-1 pr-1 text-sm font-normal">
                {kw}
                <button
                  onClick={() => onChange(keywords.filter((k) => k !== kw))}
                  className="rounded-full p-0.5 hover:bg-background/60"
                  aria-label={`Remove ${kw}`}
                >
                  <X size={13} />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            className="h-11"
          />
          <Button onClick={add} variant="outline" className="shrink-0">
            <Plus size={16} className="mr-1.5" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IncomeForm({ settings, updateSettings }: {
  settings: ReturnType<typeof useAppData>["settings"];
  updateSettings: ReturnType<typeof useAppData>["updateSettings"];
}) {
  const [defaultIncome, setDefaultIncome] = useState(settings.defaultIncome ? String(settings.defaultIncome) : "");
  const [salary, setSalary] = useState<string[]>(settings.salaryKeywords ?? []);
  const [selfTransfer, setSelfTransfer] = useState<string[]>(settings.selfTransferKeywords ?? []);
  const [savingsVault, setSavingsVault] = useState<string[]>(settings.savingsVaultKeywords ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  // Intentional sync from externally-loaded settings.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDefaultIncome(settings.defaultIncome ? String(settings.defaultIncome) : "");
    setSalary(settings.salaryKeywords ?? []);
    setSelfTransfer(settings.selfTransferKeywords ?? []);
    setSavingsVault(settings.savingsVaultKeywords ?? []);
  }, [settings]);

  const dirty =
    (parseFloat(defaultIncome) || 0) !== (settings.defaultIncome ?? 0) ||
    JSON.stringify(salary) !== JSON.stringify(settings.salaryKeywords ?? []) ||
    JSON.stringify(selfTransfer) !== JSON.stringify(settings.selfTransferKeywords ?? []) ||
    JSON.stringify(savingsVault) !== JSON.stringify(settings.savingsVaultKeywords ?? []);

  const handleSave = async () => {
    setIsSaving(true);
    setError(false);
    try {
      await updateSettings({
        ...settings,
        defaultIncome: Math.max(0, parseFloat(defaultIncome) || 0),
        salaryKeywords: salary,
        selfTransferKeywords: selfTransfer,
        savingsVaultKeywords: savingsVault,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Income & Transfers</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Teach Monera which deposits are your salary, which move between your own accounts, and which are savings.
        </p>
      </div>

      <div>
        <Label htmlFor="default-income">Default monthly salary (€)</Label>
        <Input
          id="default-income"
          type="number"
          min={0}
          inputMode="decimal"
          value={defaultIncome}
          onChange={(e) => setDefaultIncome(e.target.value)}
          placeholder="e.g. 2000"
          className="h-11 mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Used as your income for every period unless a specific month has its own planned income (set in the Budget tab). Leave blank to use the income detected from your statement.
        </p>
      </div>

      <KeywordEditor
        label="Salary keywords"
        hint="Deposits whose description contains one of these are treated as salary and excluded from “received from others”."
        placeholder="e.g. employer name"
        keywords={salary}
        onChange={setSalary}
      />
      <KeywordEditor
        label="Self-transfer keywords"
        hint="Transfers between your own accounts (often your own name). These are dropped entirely — neither income nor spending."
        placeholder="e.g. your full name"
        keywords={selfTransfer}
        onChange={setSelfTransfer}
      />
      <KeywordEditor
        label="Savings-vault keywords"
        hint="Revolut savings-vault deposits show up twice. The outgoing amount counts as Savings; the positive mirror matching these keywords is dropped."
        placeholder="e.g. eur savings"
        keywords={savingsVault}
        onChange={setSavingsVault}
      />

      <Button onClick={handleSave} disabled={isSaving || !dirty} className={cn("w-full", error ? "bg-destructive text-white" : "bg-primary text-primary-foreground")}>
        {error ? "Save failed — sign out & back in" : saved ? "✓ Saved" : isSaving ? "Saving..." : "Save Income Settings"}
      </Button>
    </div>
  );
}

type Tab = "budget" | "income" | "recurring" | "rules";

export default function SettingsPage() {
  const { month, setMonth, settings, rules, isLoading, updateSettings, updateRules } = useAppData();
  const paydayOfMonth = settings.paydayOfMonth ?? 1;
  const [tab, setTab] = useState<Tab>("budget");

  const tabs: { id: Tab; label: string }[] = [
    { id: "budget", label: "Budget" },
    { id: "income", label: "Income" },
    { id: "recurring", label: "Recurring" },
    { id: "rules", label: "Mappings" },
  ];

  return (
    <PageShell>
      <Header month={month} onMonthChange={setMonth} paydayOfMonth={paydayOfMonth} isLoading={isLoading} />

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-6 pt-5">
        {/* Tab switcher */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-secondary">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "h-9 rounded-md text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "budget" && (
          <>
            {/* Per-month budget settings */}
            <MonthForm
              key={month}
              month={month}
              settings={settings}
              paydayOfMonth={paydayOfMonth}
              updateSettings={updateSettings}
            />

            <Separator />

            {/* Global defaults */}
            <GlobalForm
              settings={settings}
              updateSettings={updateSettings}
            />
          </>
        )}

        {tab === "income" && <IncomeForm settings={settings} updateSettings={updateSettings} />}

        {tab === "recurring" && <RecurringForm settings={settings} updateSettings={updateSettings} />}

        {tab === "rules" && <RulesForm rules={rules} updateRules={updateRules} />}
      </div>
    </PageShell>
  );
}
