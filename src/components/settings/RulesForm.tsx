"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/contexts/AppDataContext";
import { cn } from "@/lib/utils";
import { Category, CategoryRule } from "@/types";
import { DEFAULT_CATEGORY_RULES } from "@/config/categories";
import { Trash2, Plus, Search } from "lucide-react";

const CATEGORIES: Category[] = ["Needs", "Wants", "Savings"];

export function RulesForm({ rules, updateRules }: {
  rules: CategoryRule[];
  updateRules: ReturnType<typeof useAppData>["updateRules"];
}) {
  const [items, setItems] = useState<CategoryRule[]>(rules);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<Category | "">("");
  const [newKw, setNewKw] = useState("");
  const [newCat, setNewCat] = useState<Category>("Wants");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); setConfirmDelete(false); };

  const bulkDelete = () => {
    setItems((prev) => prev.filter((_, idx) => !selected.has(idx)));
    exitSelectMode();
  };

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
    .filter(({ r }) =>
      (!search || r.keyword.includes(search.toLowerCase())) &&
      (!catFilter || r.category === catFilter)
    );

  const allVisibleSelected = visible.length > 0 && visible.every(({ i }) => selected.has(i));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelected((prev) => { const next = new Set(prev); visible.forEach(({ i }) => next.delete(i)); return next; });
    } else {
      setSelected((prev) => new Set([...prev, ...visible.map(({ i }) => i)]));
    }
  };

  const catColor: Record<string, string> = {
    Needs: "text-blue-600 dark:text-blue-400",
    Wants: "text-amber-600 dark:text-amber-400",
    Savings: "text-emerald-600 dark:text-emerald-400",
    Uncategorized: "text-muted-foreground",
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Rules</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          When a transaction description contains a keyword, it&apos;s automatically assigned that category. The first matching rule wins.
        </p>
      </div>

      {/* Add new */}
      <Card className="shadow-none border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Add Rule</CardTitle>
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
            Add rule
          </Button>
        </CardContent>
      </Card>

      {/* Search + category filter row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rules..."
            className="w-full h-11 pl-9 pr-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value as Category | "")}
          className="h-11 px-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring shrink-0"
        >
          <option value="">All</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* List header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{visible.length} of {items.length} rules</p>
        {!selectMode ? (
          <button
            onClick={() => setSelectMode(true)}
            className="text-xs text-primary hover:underline"
          >
            Select
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button onClick={toggleSelectAll} className="text-xs text-primary hover:underline">
              {allVisibleSelected ? "Deselect all" : "Select all"}
            </button>
            <button onClick={exitSelectMode} className="text-xs text-muted-foreground hover:underline">
              Cancel
            </button>
          </div>
        )}
      </div>

      <Card className="shadow-none border-border overflow-hidden">
        <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
          <div className="divide-y divide-border">
            {visible.map(({ r, i }) => (
              <div key={i} className="flex items-center gap-2 py-2 px-3">
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      return next;
                    })}
                    className="size-4 rounded accent-primary shrink-0 cursor-pointer"
                  />
                )}
                <input
                  value={r.keyword}
                  onChange={(e) => setRuleKeyword(i, e.target.value)}
                  disabled={selectMode}
                  className="flex-1 min-w-0 h-8 px-2 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60 disabled:cursor-default"
                />
                <select
                  value={r.category}
                  onChange={(e) => setRuleCat(i, e.target.value as Category)}
                  disabled={selectMode}
                  className={cn("h-8 px-2 rounded-md border border-input bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60 disabled:cursor-default", catColor[r.category])}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {!selectMode && (
                  <button
                    onClick={() => removeRule(i)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0"
                    aria-label={`Remove ${r.keyword}`}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bulk delete action bar */}
      {selectMode && selected.size > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-foreground">{selected.size} rule{selected.size !== 1 ? "s" : ""} selected</p>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Are you sure?</p>
              <button onClick={bulkDelete} className="text-xs font-medium text-destructive hover:underline">Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-destructive hover:underline"
            >
              <Trash2 size={14} />
              Delete {selected.size}
            </button>
          )}
        </div>
      )}

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
          {error ? "Save failed" : saved ? "✓ Saved" : isSaving ? "Saving..." : "Save Rules"}
        </Button>
      </div>
    </div>
  );
}
