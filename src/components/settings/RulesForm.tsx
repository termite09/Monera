"use client";

import { useState } from "react";
import { Trash2, Plus, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cn, getCategoryTextClass } from "@/lib/utils";
import { BUDGET_CATEGORIES } from "@/config/constants";
import { useSaveStatus } from "@/hooks/useSaveStatus";
import { Category, CategoryRule } from "@/types";
import { SaveButton } from "./SaveButton";

/** A rule while it's being edited. The id is local only — it keeps a row stable while its keyword changes. */
interface DraftRule extends CategoryRule {
  id: number;
}

let nextId = 0;
const withId = (rule: CategoryRule): DraftRule => ({ ...rule, id: nextId++ });

/** Keyword → category rules. Mount with a `key` to reset. */
export function RulesForm({ rules, updateRules }: {
  rules: CategoryRule[];
  updateRules: (r: CategoryRule[]) => Promise<void>;
}) {
  const [items, setItems] = useState(() => rules.map(withId));
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<Category | "">("");
  const [newKw, setNewKw] = useState("");
  const [newCat, setNewCat] = useState<Category>("Wants");
  const [dupError, setDupError] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { status, run } = useSaveStatus();

  const edit = (change: (prev: DraftRule[]) => DraftRule[]) => {
    setItems(change);
    setIsDirty(true);
  };

  const handleAddRule = () => {
    const keyword = newKw.trim().toLowerCase();
    if (!keyword) return;
    if (items.some((r) => r.keyword === keyword)) {
      setDupError(true);
      return;
    }
    setDupError(false);
    edit((prev) => [withId({ keyword, category: newCat }), ...prev]);
    setNewKw("");
    setNewCat("Wants");
  };
  const updateRule = (id: number, patch: Partial<CategoryRule>) =>
    edit((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); setConfirmDelete(false); };

  const handleBulkDelete = () => {
    edit((prev) => prev.filter((r) => !selected.has(r.id)));
    exitSelectMode();
  };

  const handleSave = async () => {
    const saved = await run(() => updateRules(items.map(({ keyword, category }) => ({ keyword, category }))));
    if (saved) setIsDirty(false);
  };

  const visible = items.filter((r) =>
    (!search || r.keyword.includes(search.toLowerCase())) && (!catFilter || r.category === catFilter)
  );
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of visible) {
        if (allVisibleSelected) next.delete(r.id);
        else next.add(r.id);
      }
      return next;
    });
  };

  const toggleSelected = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-foreground">Rules</h2>
        <p className="text-sm text-muted-foreground mt-0.5 max-w-[65ch]">
          Teach Monera where things belong: any transaction containing a word goes into that category. If two rules match, the first one wins.
        </p>
      </div>

      {/* Add new */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-lg font-semibold text-foreground">Add a rule</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-kw">Keyword (in description)</Label>
            <Input
              id="rule-kw"
              value={newKw}
              onChange={(e) => { setNewKw(e.target.value); setDupError(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddRule(); }}
              placeholder="e.g. netflix"
              className={cn("h-11", dupError && "border-destructive focus-visible:ring-destructive")}
            />
            {dupError && (
              <p className="text-xs text-destructive">There’s already a rule for this word.</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rule-cat">Category</Label>
            <NativeSelect id="rule-cat" value={newCat} onChange={(e) => setNewCat(e.target.value as Category)} className="h-11 font-medium">
              {BUDGET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </NativeSelect>
          </div>
          <Button onClick={handleAddRule} variant="outline" className="w-full">
            <Plus size={16} className="mr-1.5" aria-hidden />
            Add rule
          </Button>
        </CardContent>
      </Card>

      {/* Search + category filter row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rules…"
            aria-label="Search rules"
            className="h-11 pl-9"
          />
        </div>
        <NativeSelect
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value as Category | "")}
          aria-label="Filter rules by category"
          className="h-11 px-2 shrink-0"
        >
          <option value="">All</option>
          {BUDGET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </NativeSelect>
      </div>

      {/* List header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground max-w-[65ch]">{visible.length} of {items.length} rules</p>
        {!selectMode ? (
          <button type="button" onClick={() => setSelectMode(true)} className="tap-area text-xs text-primary hover:underline">
            Select
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button type="button" onClick={toggleSelectAll} className="tap-area text-xs text-primary hover:underline">
              {allVisibleSelected ? "Deselect all" : "Select all"}
            </button>
            <button type="button" onClick={exitSelectMode} className="tap-area text-xs text-muted-foreground hover:underline">
              Cancel
            </button>
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
          <div className="divide-y divide-border">
            {visible.map((r) => (
              <div key={r.id} className="flex items-center gap-2 py-2 px-3">
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggleSelected(r.id)}
                    aria-label={`Select rule ${r.keyword}`}
                    className="size-5 rounded accent-primary shrink-0 cursor-pointer"
                  />
                )}
                <Input
                  value={r.keyword}
                  onChange={(e) => updateRule(r.id, { keyword: e.target.value })}
                  disabled={selectMode}
                  aria-label="Shop name contains"
                  className="flex-1 min-w-0 h-11 sm:h-8 px-2 rounded-md bg-background focus-visible:ring-1 focus-visible:ring-offset-0 disabled:opacity-60 disabled:cursor-default"
                />
                <NativeSelect
                  value={r.category}
                  onChange={(e) => updateRule(r.id, { category: e.target.value as Category })}
                  disabled={selectMode}
                  aria-label={`Category for ${r.keyword || "this rule"}`}
                  className={cn("h-11 sm:h-8 px-2 rounded-md bg-background text-xs font-medium", getCategoryTextClass(r.category))}
                >
                  {BUDGET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </NativeSelect>
                {!selectMode && (
                  <button
                    type="button"
                    onClick={() => edit((prev) => prev.filter((x) => x.id !== r.id))}
                    className="text-muted-foreground hover:text-destructive transition-colors size-11 sm:size-8 flex items-center justify-center rounded-md shrink-0"
                    aria-label={`Remove ${r.keyword}`}
                  >
                    <Trash2 size={15} aria-hidden />
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
              <button type="button" onClick={handleBulkDelete} className="tap-area text-xs font-medium text-destructive hover:underline">Delete</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="tap-area text-xs text-muted-foreground hover:underline">Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="tap-area flex items-center gap-1.5 text-sm font-medium text-destructive hover:underline">
              <Trash2 size={14} aria-hidden />
              Delete {selected.size}
            </button>
          )}
        </div>
      )}

      <SaveButton status={status} onClick={handleSave} disabled={!isDirty} label="Save rules" />
    </div>
  );
}
