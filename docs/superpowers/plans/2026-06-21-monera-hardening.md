# Monera Full-Sweep Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all correctness bugs, UX friction, dead code, and performance issues found in the June 2026 system audit across 5 independently-shippable phases.

**Architecture:** Client-only Next.js 16 app; Google Drive as backend; TanStack Query for cache; Context API for app state. All mutations read-then-write to Drive, then patch the in-memory query cache. No database, no API routes.

**Tech Stack:** Next.js 16, React 19, TypeScript, TanStack Query v5, Tailwind CSS, shadcn/ui, Vitest, Google Drive API (direct from browser).

## Global Constraints

- Test runner: `npx vitest run` — all test files live in `src/__tests__/`
- TypeScript check: `npx tsc --noEmit`
- No new dependencies unless strictly required
- Never change a transaction's `id` when editing — overrides and exclusions are keyed by id
- `roundMoney()` is the only correct way to produce final monetary amounts — always use it at aggregation/submission boundaries
- Every Drive mutation follows the pattern: optimistic cache patch → Drive write → reconcile cache patch → rollback on error

---

## Phase 1 — Critical Correctness

---

### Task 1: Fix salary double-counting in `useBudget`

**Files:**
- Modify: `src/hooks/useBudget.ts:51-55`
- Test: `src/__tests__/finance.test.ts` (add cases)

**Interfaces:**
- Produces: `income` field in `MonthSummary` is now `salaryBasis + additionalIncome` (not `detectedIncome`) when a salary basis exists

**The bug:** Line 52–54 of `useBudget.ts`:
```ts
const income = roundMoney(
  salaryBasis > 0
    ? salaryBasis + detectedIncome   // BUG: double-counts salary when keywords are set
    : detectedIncome
);
```
When `salaryBasis > 0` and salary keywords are configured, `detectedIncome` includes the salary transaction AND `salaryBasis` adds it again. The correct term is `additionalIncome`, which already excludes salary-matching transactions.

When no keywords are configured, `additionalIncome === detectedIncome`, so the formula is identical — no regression.

- [ ] **Step 1: Write failing test**

Add to `src/__tests__/finance.test.ts` after the existing `useBudget` tests:

```ts
describe("useBudget — salary double-counting", () => {
  const salarySettings: Settings = {
    ...baseSettings,
    defaultIncome: 3000,
    salaryKeywords: ["salary"],
    monthlyBudgets: {},
  };

  it("does not double-count salary when keyword matches CSV transaction", () => {
    const txs: Transaction[] = [
      tx({ amount: 3000, type: "income", description: "Monthly Salary", date: "2024-06-10", category: "Uncategorized" }),
      tx({ amount: 50, type: "income", description: "Freelance payment", date: "2024-06-12", category: "Uncategorized" }),
    ];
    const { summary } = useBudget(txs, salarySettings, "2024-06");
    // salary (3000 from settings) + freelance (50) = 3050, NOT 6050
    expect(summary.income).toBe(3050);
  });

  it("uses detectedIncome when no salary basis is configured", () => {
    const txs: Transaction[] = [
      tx({ amount: 2800, type: "income", description: "Wages", date: "2024-06-10", category: "Uncategorized" }),
    ];
    const { summary } = useBudget(txs, { ...baseSettings, monthlyBudgets: {} }, "2024-06");
    expect(summary.income).toBe(2800);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/finance.test.ts
```
Expected: FAIL — "salary double-counting" test reports `6050` when expecting `3050`.

- [ ] **Step 3: Apply the one-line fix in `src/hooks/useBudget.ts`**

Change lines 51–55 from:
```ts
const income = roundMoney(
  salaryBasis > 0
    ? salaryBasis +  detectedIncome 
    : detectedIncome
);
```
To:
```ts
const income = roundMoney(
  salaryBasis > 0
    ? salaryBasis + additionalIncome
    : detectedIncome
);
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/finance.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useBudget.ts src/__tests__/finance.test.ts
git commit -m "fix: correct salary double-counting in useBudget income formula

When salary keywords are configured, salaryBasis already represents the
employer payment — adding additionalIncome (which excludes keyword matches)
prevents counting the salary twice when it also appears in the CSV."
```

---

### Task 2: Add `updateManualTransaction` to prevent data loss on edit

**Files:**
- Modify: `src/hooks/useTransactions.ts` (add `updateManualTransaction` after `deleteManualTransaction`)
- Modify: `src/contexts/AppDataContext.tsx` (add to interface, useMemo deps, and returned value)
- Modify: `src/app/(auth)/transactions/page.tsx` (replace delete+add edit handler)

**Interfaces:**
- Produces: `updateManualTransaction(id: string, patch: Omit<Transaction, "id" | "source" | "categorySource">): Promise<void>` — updates in-place, preserving the same `id`

**The bug:** `transactions/page.tsx` lines 443–448 delete the old transaction (erasing its override/exclusion in `category-overrides.json` and `excluded-transactions.json`) then create a new one with a fresh `generateId()`.

- [ ] **Step 1: Add `updateManualTransaction` to `src/hooks/useTransactions.ts`**

Insert after `deleteManualTransaction` (after line 189), before the `updateCategory` function:

```ts
const updateManualTransaction = useCallback(
  async (txId: string, updates: Omit<Transaction, "id" | "source" | "categorySource">) => {
    if (!accessToken || !structure) return;
    const existing = await readAppFile<Transaction[]>(accessToken, structure.fileIds.manualTransactions);
    const updated = existing.map((t) =>
      t.id === txId ? { ...t, ...updates } : t
    );
    await writeAppFile(accessToken, structure.fileIds.manualTransactions, updated);
    patch((d) => ({
      ...d,
      rawTxs: d.rawTxs.map((t) =>
        t.id === txId ? { ...t, ...updates } : t
      ),
    }));
  },
  [accessToken, structure, patch]
);
```

Also add `updateManualTransaction` to the return object at line 344:
```ts
return {
  transactions,
  isLoading: query.isPending,
  hasLoaded: query.isSuccess,
  error,
  needsReauth,
  refetch: query.refetch,
  addManualTransaction,
  deleteManualTransaction,
  updateManualTransaction,   // add this
  updateCategory,
  bulkUpdateCategory,
  bulkExclude,
  resetToDefault,
  bulkResetToDefault,
  toggleExclude,
};
```

- [ ] **Step 2: Expose `updateManualTransaction` through `AppDataContext`**

In `src/contexts/AppDataContext.tsx`:

Add to the `AppDataContextValue` interface (after `deleteManualTransaction` on line 29):
```ts
updateManualTransaction: (id: string, updates: Omit<Transaction, "id" | "source" | "categorySource">) => Promise<void>;
```

Destructure it from `useTransactions` (add after `deleteManualTransaction` on line 57):
```ts
updateManualTransaction,
```

Add to the `useMemo` value object (after `deleteManualTransaction` on line 99):
```ts
updateManualTransaction,
```

Add to the `useMemo` dependency array (after `deleteManualTransaction`):
```ts
updateManualTransaction,
```

- [ ] **Step 3: Use `updateManualTransaction` in `transactions/page.tsx`**

In `src/app/(auth)/transactions/page.tsx`, destructure `updateManualTransaction` from `useAppData()` (line 72–76):
```ts
const {
  month, setMonth, transactions, settings, isLoading, txError,
  addManualTransaction, deleteManualTransaction, updateManualTransaction,
  bulkUpdateCategory, bulkExclude, bulkResetToDefault, toggleExclude, refetch,
} = useAppData();
```

Replace the edit handler (lines 438–451):
```tsx
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
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTransactions.ts src/contexts/AppDataContext.tsx src/app/\(auth\)/transactions/page.tsx
git commit -m "fix: preserve transaction id on edit to prevent orphaned overrides

Replaced delete+add edit flow with updateManualTransaction that patches
the existing record in-place. Category overrides and exclusion entries
keyed to the old id are no longer silently discarded."
```

---

### Task 3: Fix index-based selection state in `RulesForm`

**Files:**
- Modify: `src/components/settings/RulesForm.tsx`

**The bug:** `selected` is `Set<number>` of array indices. After any delete/reorder, indices shift and selections misalign (e.g. select items 0 and 2, delete item 1 → item 2 is now at index 1 but `selected` still has index 2 which is now a different rule).

- [ ] **Step 1: Change `selected` state type and update all usages**

In `src/components/settings/RulesForm.tsx`, make these changes:

**Line 27** — change state type:
```ts
// Before
const [selected, setSelected] = useState<Set<number>>(new Set());
// After
const [selected, setSelected] = useState<Set<string>>(new Set());
```

**`bulkDelete` function (line 59–62)** — filter by keyword, not index:
```ts
const bulkDelete = () => {
  setItems((prev) => prev.filter((r) => !selected.has(r.keyword)));
  exitSelectMode();
};
```

**`allVisibleSelected` (line 85)** — use keyword:
```ts
const allVisibleSelected = visible.length > 0 && visible.every(({ r }) => selected.has(r.keyword));
```

**`toggleSelectAll` (lines 87–93)** — use keyword:
```ts
const toggleSelectAll = () => {
  if (allVisibleSelected) {
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach(({ r }) => next.delete(r.keyword));
      return next;
    });
  } else {
    setSelected((prev) => new Set([...prev, ...visible.map(({ r }) => r.keyword)]));
  }
};
```

**Checkbox render (lines 198–210)** — use keyword as key and for checked/onChange:
```tsx
{visible.map(({ r, i }) => (
  <div key={r.keyword} className="flex items-center gap-2 py-2 px-3">
    {selectMode && (
      <input
        type="checkbox"
        checked={selected.has(r.keyword)}
        onChange={() => setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(r.keyword)) next.delete(r.keyword);
          else next.add(r.keyword);
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
```

Note: `key={r.keyword}` instead of `key={i}` also fixes React's key stability during deletes.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/RulesForm.tsx
git commit -m "fix: use keyword-keyed selection set in RulesForm

Index-based selection broke when rules were deleted or reordered because
indices shifted. Keyword is unique per rule and stable across mutations."
```

---

### Task 4: Round amounts and use dynamic currency in `AddTransactionForm`

**Files:**
- Modify: `src/components/transactions/AddTransactionForm.tsx`

**Bugs:**
1. `parseFloat(amount)` can produce `12.994999...` — should use `roundMoney()`
2. Currency hardcoded as `"EUR"` — should read `settings.currency`

- [ ] **Step 1: Write failing test for amount rounding**

Add to `src/__tests__/finance.test.ts`:

```ts
describe("roundMoney", () => {
  it("eliminates floating-point drift", () => {
    // 12.995 stored as IEEE 754 rounds incorrectly without EPSILON guard
    expect(roundMoney(parseFloat("12.995"))).toBe(13.00);
    expect(roundMoney(0.1 + 0.2)).toBe(0.30);
    expect(roundMoney(1234.56789)).toBe(1234.57);
  });
});
```

- [ ] **Step 2: Run test to verify it passes** (roundMoney already works — this confirms the utility is correct before we rely on it)

```bash
npx vitest run src/__tests__/finance.test.ts
```
Expected: PASS

- [ ] **Step 3: Update `AddTransactionForm.tsx`**

Add import at the top (line 5, after the existing imports):
```ts
import { cn, roundMoney } from "@/lib/utils";
import { useAppData } from "@/contexts/AppDataContext";
```

Inside the component function (after line 31 `const [loading, setLoading] = useState(false);`), add:
```ts
const { settings } = useAppData();
const currency = settings.currency ?? "EUR";
```

Update the label on line 91 to be dynamic:
```tsx
<Label htmlFor="tx-amount">Amount ({currency}) <span className="text-destructive">*</span></Label>
```

In `handleSubmit`, replace lines 40–56:
```ts
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const parsedAmount = roundMoney(parseFloat(amount));
  if (!description || isNaN(parsedAmount) || parsedAmount <= 0 || !date) return;
  setLoading(true);
  try {
    await onSubmit({
      date,
      description,
      amount: parsedAmount,
      type,
      currency,
      category: type === "income" ? "Uncategorized" : category,
      notes: notes || undefined,
      excluded: false,
    });
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/components/transactions/AddTransactionForm.tsx src/__tests__/finance.test.ts
git commit -m "fix: round transaction amounts and use dynamic currency in AddTransactionForm

parseFloat without rounding can produce sub-cent drift. roundMoney()
eliminates floating-point accumulation at the submission boundary.
Currency now reads from settings instead of hardcoded EUR."
```

---

## Phase 2 — UX Clarity & Feedback

---

### Task 5: Show inline validation errors in `AddTransactionForm`

**Files:**
- Modify: `src/components/transactions/AddTransactionForm.tsx`

**Issue:** `handleSubmit` silently returns when validation fails. Users tap "Add" with no feedback.

- [ ] **Step 1: Add `errors` state and validation logic**

In `src/components/transactions/AddTransactionForm.tsx`, add after the `loading` state (line 31):
```ts
const [errors, setErrors] = useState<Record<string, string>>({});
```

Replace `handleSubmit`:
```ts
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const newErrors: Record<string, string> = {};
  if (!date) newErrors.date = "Date is required";
  if (!description.trim()) newErrors.description = "Description is required";
  const parsedAmount = roundMoney(parseFloat(amount));
  if (!amount) newErrors.amount = "Amount is required";
  else if (isNaN(parsedAmount) || parsedAmount <= 0) newErrors.amount = "Enter a valid amount greater than 0";
  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors);
    return;
  }
  setErrors({});
  setLoading(true);
  try {
    await onSubmit({
      date,
      description: description.trim(),
      amount: parsedAmount,
      type,
      currency,
      category: type === "income" ? "Uncategorized" : category,
      notes: notes || undefined,
      excluded: false,
    });
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 2: Clear field errors on change and render error messages**

Add `onChange` error-clearing wrappers and error paragraphs to each field.

**Date field** (replace lines 81–83):
```tsx
<div className="flex flex-col gap-1.5">
  <Label htmlFor="tx-date">Date <span className="text-destructive">*</span></Label>
  <Input
    id="tx-date"
    type="date"
    value={date}
    onChange={(e) => { setDate(e.target.value); setErrors((prev) => { const n = {...prev}; delete n.date; return n; }); }}
    className={cn("h-11", errors.date && "border-destructive focus-visible:ring-destructive")}
  />
  {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
</div>
```

**Description field** (replace lines 85–88):
```tsx
<div className="flex flex-col gap-1.5">
  <Label htmlFor="tx-desc">Description <span className="text-destructive">*</span></Label>
  <Input
    id="tx-desc"
    value={description}
    onChange={(e) => { setDescription(e.target.value); setErrors((prev) => { const n = {...prev}; delete n.description; return n; }); }}
    placeholder="e.g. Wolt delivery"
    className={cn("h-11", errors.description && "border-destructive focus-visible:ring-destructive")}
  />
  {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
</div>
```

**Amount field** (replace lines 90–93):
```tsx
<div className="flex flex-col gap-1.5">
  <Label htmlFor="tx-amount">Amount ({currency}) <span className="text-destructive">*</span></Label>
  <Input
    id="tx-amount"
    type="number"
    value={amount}
    onChange={(e) => { setAmount(e.target.value); setErrors((prev) => { const n = {...prev}; delete n.amount; return n; }); }}
    placeholder="0.00"
    className={cn("h-11", errors.amount && "border-destructive focus-visible:ring-destructive")}
  />
  {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
</div>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/transactions/AddTransactionForm.tsx
git commit -m "fix: show inline validation errors in AddTransactionForm

Silent return on invalid input left users with no feedback. Errors now
appear below each invalid field with red border and descriptive message."
```

---

### Task 6: Fix type-switch category reset in `AddTransactionForm`

**Files:**
- Modify: `src/components/transactions/AddTransactionForm.tsx`

**Issue:** Line 35 — `selectType` always resets category to "Wants" when switching away from income, even when editing an existing expense that had "Needs" selected.

- [ ] **Step 1: Fix `selectType`**

Replace lines 33–36:
```ts
// Before
const selectType = (t: TransactionType) => {
  setType(t);
  if (t !== "income") setCategory("Wants");
};

// After
const selectType = (t: TransactionType) => {
  setType((prev) => {
    if (prev === "income" && t !== "income") setCategory("Wants");
    return t;
  });
};
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/transactions/AddTransactionForm.tsx
git commit -m "fix: only reset category to Wants when switching from income to expense

Switching between expense states now preserves the user's category
selection instead of always reverting to Wants."
```

---

### Task 7: Replace fragile `onBlur` delete dismiss in `TransactionRow`

**Files:**
- Modify: `src/components/transactions/TransactionRow.tsx`

**Issue:** Lines 161–170 — the initial delete button has `onBlur={() => setConfirmDelete(false)}`. On mobile, `blur` fires unreliably on touch. There is also no explicit "Cancel" button — the only way to cancel is to blur the element.

- [ ] **Step 1: Add explicit cancel button, remove `onBlur`, add auto-dismiss timer**

Replace the delete button section (lines 161–170):
```tsx
) : (
  <button
    onClick={() => setConfirmDelete(true)}
    className="p-1 rounded-md text-muted-foreground/30 transition-colors hover:text-destructive hover:bg-secondary"
    aria-label="Delete transaction"
    title="Delete manual transaction"
  >
    <Trash2 size={14} />
  </button>
)}
```

With:
```tsx
) : (
  <button
    onClick={() => {
      setConfirmDelete(true);
      // Auto-dismiss after 4 seconds if not confirmed — fallback for mobile
      setTimeout(() => setConfirmDelete(false), 4000);
    }}
    className="p-1 rounded-md text-muted-foreground/30 transition-colors hover:text-destructive hover:bg-secondary"
    aria-label="Delete transaction"
    title="Delete manual transaction"
  >
    <Trash2 size={14} />
  </button>
)}
```

Add an explicit "×" cancel button to the confirm state (replace lines 139–160):
```tsx
{confirmDelete ? (
  <div className="flex items-center gap-0.5">
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={async () => {
        if (deleting) return;
        setDeleting(true);
        try {
          await onDelete(tx.id);
        } catch {
          // Handled upstream; reset UI so the row doesn't stay spinning.
        } finally {
          setDeleting(false);
          setConfirmDelete(false);
        }
      }}
      disabled={deleting}
      className="p-1 rounded-md text-destructive bg-destructive/10 transition-colors disabled:cursor-wait hover:bg-destructive/20"
      aria-label="Confirm delete"
      title="Tap again to confirm"
    >
      {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
    </button>
    <button
      onClick={() => setConfirmDelete(false)}
      className="p-1 rounded-md text-muted-foreground/40 transition-colors hover:text-foreground hover:bg-secondary"
      aria-label="Cancel delete"
    >
      ×
    </button>
  </div>
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/transactions/TransactionRow.tsx
git commit -m "fix: replace onBlur delete dismiss with explicit cancel button

onBlur is unreliable on mobile touch. Added explicit × cancel button
next to confirm delete, and a 4-second auto-dismiss as fallback."
```

---

### Task 8: Clear selection when scope filters change in `transactions/page.tsx`

**Files:**
- Modify: `src/app/(auth)/transactions/page.tsx`

**Issue:** When a user changes `filterCat`, `filterType`, `rangeMode`, `customFrom`, or `customTo`, the `selected` set retains IDs that may no longer be in the filtered list. Bulk actions silently skip invisible IDs.

- [ ] **Step 1: Add selection-clear effect**

Add after the `isBulkLoading` state declaration (line 118):
```ts
// Clear selection whenever the scope changes — selected IDs from a previous
// filter set are invisible in the new view and would confuse bulk actions.
useEffect(() => {
  setSelected(new Set());
}, [filterCat, filterType, rangeMode, customFrom, customTo]);
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/transactions/page.tsx
git commit -m "fix: clear transaction selection when scope filters change

Previously selected IDs persisted across filter changes and were
silently skipped by bulk actions. Selection now resets on any
filter that changes which transactions are in scope."
```

---

## Phase 3 — Dead Code & Code Quality

---

### Task 9: Remove unused import and centralize category text classes

**Files:**
- Modify: `src/lib/utils.ts` (add `getCategoryTextClass`)
- Modify: `src/components/transactions/TransactionRow.tsx` (replace `catText` map)
- Modify: `src/components/settings/RulesForm.tsx` (replace `catColor` map, remove unused import)

**Issue:**
- `DEFAULT_CATEGORY_RULES` is imported in `RulesForm.tsx` but never used
- `catText` (TransactionRow) and `catColor` (RulesForm) are identical Tailwind class maps duplicated across two files

- [ ] **Step 1: Write test to verify `getCategoryTextClass` returns correct classes**

Add to `src/__tests__/utils.test.ts`:
```ts
import { getCategoryTextClass } from "@/lib/utils";

describe("getCategoryTextClass", () => {
  it("returns correct Tailwind text classes for each category", () => {
    expect(getCategoryTextClass("Needs")).toBe("text-blue-600 dark:text-blue-400");
    expect(getCategoryTextClass("Wants")).toBe("text-amber-600 dark:text-amber-400");
    expect(getCategoryTextClass("Savings")).toBe("text-emerald-600 dark:text-emerald-400");
    expect(getCategoryTextClass("Uncategorized")).toBe("text-muted-foreground");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/utils.test.ts
```
Expected: FAIL — "getCategoryTextClass is not a function"

- [ ] **Step 3: Add `getCategoryTextClass` to `src/lib/utils.ts`**

Add after `getCategoryColor` (after line 115):
```ts
export function getCategoryTextClass(category: string): string {
  const classes: Record<string, string> = {
    Needs: "text-blue-600 dark:text-blue-400",
    Wants: "text-amber-600 dark:text-amber-400",
    Savings: "text-emerald-600 dark:text-emerald-400",
    Uncategorized: "text-muted-foreground",
  };
  return classes[category] ?? "text-muted-foreground";
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/utils.test.ts
```
Expected: PASS

- [ ] **Step 5: Update `TransactionRow.tsx` — replace inline `catText` map**

Remove lines 19–24 (the `catText` constant).

Add `getCategoryTextClass` to the import on line 6:
```ts
import { formatCurrency, cleanDescription, cn, getCategoryTextClass } from "@/lib/utils";
```

On line 93 (the `catText[tx.category]` usage), replace:
```tsx
<span className={cn("text-xs font-medium whitespace-nowrap flex items-center gap-0.5", catText[tx.category])}>
```
With:
```tsx
<span className={cn("text-xs font-medium whitespace-nowrap flex items-center gap-0.5", getCategoryTextClass(tx.category))}>
```

- [ ] **Step 6: Update `RulesForm.tsx` — remove unused import and `catColor` map**

Remove line 11: `import { DEFAULT_CATEGORY_RULES } from "@/config/categories";`

Remove lines 95–100 (the `catColor` constant).

Add `getCategoryTextClass` to the utils import on line 9:
```ts
import { cn, getCategoryTextClass } from "@/lib/utils";
```

Replace all 3 usages of `catColor[...]` with `getCategoryTextClass(...)`:
- Line 137: `className={cn("h-11 px-3 rounded-lg ...", catColor[newCat])}` → `getCategoryTextClass(newCat)`
- Line 222: `className={cn("h-8 px-2 rounded-md ...", catColor[r.category])}` → `getCategoryTextClass(r.category)`

- [ ] **Step 7: Run all tests and type-check**

```bash
npx vitest run && npx tsc --noEmit
```
Expected: all PASS, 0 type errors

- [ ] **Step 8: Verify unused import is gone**

```bash
grep -r "DEFAULT_CATEGORY_RULES" /Users/termite/monera/src/
```
Expected: no output

- [ ] **Step 9: Commit**

```bash
git add src/lib/utils.ts src/components/transactions/TransactionRow.tsx src/components/settings/RulesForm.tsx src/__tests__/utils.test.ts
git commit -m "refactor: centralize category text classes in getCategoryTextClass utility

Removed duplicate catText/catColor maps from TransactionRow and RulesForm.
Both now import getCategoryTextClass from lib/utils — single source of truth.
Also removes unused DEFAULT_CATEGORY_RULES import from RulesForm."
```

---

### Task 10: Add budget rule percentage guard and fix stale useMemo deps

**Files:**
- Modify: `src/hooks/useBudget.ts` (add dev warning)
- Modify: `src/app/(auth)/dashboard/page.tsx` (fix `periodIncomeTxs` deps)
- Modify: `src/app/(auth)/transactions/page.tsx` (fix inline type import)

- [ ] **Step 1: Add budget percentage guard to `useBudget.ts`**

Add after line 22 (after `const budgetRule = ...`):
```ts
if (process.env.NODE_ENV === "development") {
  const ruleSum = budgetRule.needs + budgetRule.wants + budgetRule.savings;
  if (ruleSum !== 100) {
    console.warn(`[useBudget] Budget rule percentages sum to ${ruleSum}, expected 100`);
  }
}
```

- [ ] **Step 2: Remove stale deps from `periodIncomeTxs` memo in `dashboard/page.tsx`**

Line 141 currently:
```ts
}, [allTxs, month, paydayOfMonth, salaryBasis, salaryKeywords]);
```
Change to:
```ts
}, [allTxs, month, paydayOfMonth]);
```
`salaryBasis` and `salaryKeywords` are derived values (recreated every render from `settings`) that don't influence this memo's filtering logic — they were leftover from a prior implementation. The memo only filters by date range and type, which is fully determined by `allTxs`, `month`, and `paydayOfMonth`.

- [ ] **Step 3: Fix inline type import in `transactions/page.tsx`**

Line 96:
```ts
// Before
const [editingTx, setEditingTx] = useState<import("@/types").Transaction | null>(null);
// After
const [editingTx, setEditingTx] = useState<Transaction | null>(null);
```
`Transaction` is already imported at line 22.

- [ ] **Step 4: Replace `JSON.stringify` dirty check in `RulesForm.tsx` with a dirty flag**

In `src/components/settings/RulesForm.tsx`:

After the `error` state (line 31), add:
```ts
const [isDirty, setIsDirty] = useState(false);
```

Remove line 37: `const dirty = JSON.stringify(items) !== JSON.stringify(rules);`

Update `useEffect` (line 35) to reset dirty flag when external rules reload:
```ts
useEffect(() => {
  setItems(rules);
  setIsDirty(false);
}, [rules]);
```

Update `addRule` — add `setIsDirty(true)` after `setItems(...)` (line 47):
```ts
setItems((prev) => [{ keyword: kw, category: newCat }, ...prev]);
setIsDirty(true);
setNewKw("");
setNewCat("Wants");
```

Update `setRuleCat` (line 51):
```ts
const setRuleCat = (i: number, category: Category) => {
  setItems((prev) => prev.map((r, idx) => (idx === i ? { ...r, category } : r)));
  setIsDirty(true);
};
```

Update `setRuleKeyword` (line 53):
```ts
const setRuleKeyword = (i: number, keyword: string) => {
  setItems((prev) => prev.map((r, idx) => (idx === i ? { ...r, keyword } : r)));
  setIsDirty(true);
};
```

Update `removeRule` (line 55):
```ts
const removeRule = (i: number) => {
  setItems((prev) => prev.filter((_, idx) => idx !== i));
  setIsDirty(true);
};
```

Update `bulkDelete` (line 59) — already calls `setItems`, add `setIsDirty(true)` before `exitSelectMode()`:
```ts
const bulkDelete = () => {
  setItems((prev) => prev.filter((r) => !selected.has(r.keyword)));
  setIsDirty(true);
  exitSelectMode();
};
```

Update `handleSave` — reset dirty on success (after `setSaved(true)`):
```ts
setSaved(true);
setIsDirty(false);
setTimeout(() => setSaved(false), 2000);
```

Replace the Save button's `disabled` prop (line 267): `disabled={isSaving || !dirty}` → `disabled={isSaving || !isDirty}`

- [ ] **Step 5: Run all tests and type-check**

```bash
npx vitest run && npx tsc --noEmit
```
Expected: all PASS, 0 type errors

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useBudget.ts src/app/\(auth\)/dashboard/page.tsx src/app/\(auth\)/transactions/page.tsx src/components/settings/RulesForm.tsx
git commit -m "refactor: remove dead code and fix stale memo deps

- Add dev-mode warning when budget rule percentages don't sum to 100
- Remove salaryBasis/salaryKeywords from periodIncomeTxs memo deps (not used in filter)
- Fix inline Transaction type import in transactions page
- Replace O(n) JSON.stringify dirty check with O(1) isDirty flag in RulesForm"
```

---

## Phase 4 — Performance

---

### Task 11: Debounce sessionStorage writes and cap recurring search range

**Files:**
- Modify: `src/app/(auth)/transactions/page.tsx`

- [ ] **Step 1: Debounce the sessionStorage write effect**

Replace lines 99–103:
```ts
// Before
useEffect(() => {
  sessionStorage.setItem(FILTER_KEY, JSON.stringify({
    search, filterCat, filterType, rangeMode, customFrom, customTo, sortField, sortDir,
  } satisfies StoredFilters));
}, [search, filterCat, filterType, rangeMode, customFrom, customTo, sortField, sortDir]);

// After
useEffect(() => {
  const timer = setTimeout(() => {
    sessionStorage.setItem(FILTER_KEY, JSON.stringify({
      search, filterCat, filterType, rangeMode, customFrom, customTo, sortField, sortDir,
    } satisfies StoredFilters));
  }, 400);
  return () => clearTimeout(timer);
}, [search, filterCat, filterType, rangeMode, customFrom, customTo, sortField, sortDir]);
```

- [ ] **Step 2: Cap recurring bill generation during search**

In the `scopedTxs` useMemo, replace lines 141–145:
```ts
// Before
if (searching) {
  const dates = transactions.map((t) => t.date).sort();
  const earliest = dates[0] ? new Date(dates[0] + "T00:00:00") : new Date();
  recurringTxs = getRecurringInRange(payments, earliest, new Date(), paydayOfMonth, currency);
  inRange = () => true;
}

// After
if (searching) {
  const dates = transactions.map((t) => t.date).sort();
  const rawEarliest = dates[0] ? new Date(dates[0] + "T00:00:00") : new Date();
  // Cap to a rolling 24-month window to bound the recurring-bill generation loop.
  const cap = new Date();
  cap.setMonth(cap.getMonth() - 24);
  const earliest = rawEarliest > cap ? rawEarliest : cap;
  recurringTxs = getRecurringInRange(payments, earliest, new Date(), paydayOfMonth, currency);
  inRange = () => true;
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/app/\(auth\)/transactions/page.tsx
git commit -m "perf: debounce sessionStorage writes and cap recurring search range

sessionStorage was written on every keystroke. 400ms debounce reduces
unnecessary I/O during typing.

Recurring bill generation during global search was unbounded for accounts
with years of history. Capped to a rolling 24-month window."
```

---

### Task 12: Add pagination to the transaction list

**Files:**
- Modify: `src/app/(auth)/transactions/page.tsx`

**Issue:** `filtered.map(tx => <TransactionRow>)` renders all transactions at once. For 500+ transactions this creates a large DOM tree and slow initial paint.

- [ ] **Step 1: Add page state and constants**

After the `isBulkLoading` state (line 118), add:
```ts
const PAGE_SIZE = 50;
const [page, setPage] = useState(1);
```

Reset page whenever filters or sort change:
```ts
useEffect(() => {
  setPage(1);
}, [filterCat, filterType, rangeMode, customFrom, customTo, search, sortField, sortDir]);
```

- [ ] **Step 2: Slice the rendered list and add "Load more" button**

Replace the `{filtered.map((tx) => (...))}` block (lines 372–385) to render `filtered.slice(0, page * PAGE_SIZE)`:

```tsx
<div className="divide-y divide-border">
  {filtered.slice(0, page * PAGE_SIZE).map((tx) => (
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
  {filtered.length > page * PAGE_SIZE && (
    <button
      onClick={() => setPage((p) => p + 1)}
      className="w-full py-3 text-sm text-primary hover:bg-secondary/50 transition-colors"
    >
      Load more ({filtered.length - page * PAGE_SIZE} remaining)
    </button>
  )}
</div>
```

- [ ] **Step 3: Update "Select all" button to select all filtered (not just visible)**

The "Select all" header button (lines 351–369) already selects `filtered.map(t => t.id)` — this is correct, it selects ALL filtered transactions, not just the visible page. No change needed.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/transactions/page.tsx
git commit -m "perf: paginate transaction list with load-more pattern

Rendering all transactions at once causes DOM pressure for accounts with
500+ rows. Initial render now shows 50 rows with a load-more button.
Page resets to 1 on any filter or sort change."
```

---

## Phase 5 — Architecture (Foundation Hardening)

---

### Task 13: Prune stale category overrides on load

**Files:**
- Modify: `src/hooks/useTransactions.ts`

**Issue:** `category-overrides.json` accumulates entries for deleted/replaced transactions indefinitely. Over years, this file grows with orphaned IDs that slow JSON parsing.

- [ ] **Step 1: Add pruning logic to `loadTxData`**

In `src/hooks/useTransactions.ts`, after the `return` statement inside `loadTxData` is assembled (lines 92–96), add pruning before the return:

```ts
// Prune overrides whose transaction IDs no longer exist in the merged set.
// This keeps category-overrides.json from accumulating orphaned entries
// as transactions are deleted or CSVs are re-uploaded.
const liveIds = new Set(mergeTransactions(importedTxs, manualTxs ?? []).map((t) => t.id));
const prunedOverrides = Object.fromEntries(
  Object.entries(ov ?? {}).filter(([id]) => liveIds.has(id))
);
const overridesPruned = Object.keys(prunedOverrides).length !== Object.keys(ov ?? {}).length;
if (overridesPruned) {
  writeAppFile(accessToken, structure.fileIds.categoryOverrides, prunedOverrides).catch(() => {});
}

return {
  rawTxs: mergeTransactions(importedTxs, manualTxs ?? []),
  overrides: prunedOverrides,
  excludedIds: ex ?? [],
};
```

Note: `mergeTransactions` is already imported. The double call is fine — `mergeTransactions` is a pure function and the result set is small. If profiling shows this matters, extract to a variable.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTransactions.ts
git commit -m "fix: prune stale category overrides on transaction load

category-overrides.json accumulated orphaned entries for deleted
transactions indefinitely. Entries whose IDs don't exist in the current
transaction set are pruned and written back to Drive each session."
```

---

### Task 14: Settings schema migration for new default fields

**Files:**
- Modify: `src/hooks/useSettings.ts`

**Issue:** When new fields are added to `DEFAULT_SETTINGS`, existing users who have a persisted `settings.json` on Drive don't get the new fields until they manually reset — because the saved object is spread over defaults, not the other way around.

- [ ] **Step 1: Read `useSettings.ts` to understand current merge logic**

```bash
cat /Users/termite/monera/src/hooks/useSettings.ts
```

- [ ] **Step 2: Add a `migrateSettings` function and apply it on load**

In `src/hooks/useSettings.ts`, add a migration helper before the hook:

```ts
import { DEFAULT_SETTINGS } from "@/config/settings";

function migrateSettings(loaded: Partial<Settings>): Settings {
  // Deep-merge: defaults fill any keys missing from the loaded object.
  // Nested objects (monthlyBudgets, defaultBudgetRule) are merged shallowly —
  // user values take precedence over defaults at each level.
  return {
    ...DEFAULT_SETTINGS,
    ...loaded,
    defaultBudgetRule: {
      ...DEFAULT_SETTINGS.defaultBudgetRule,
      ...(loaded.defaultBudgetRule ?? {}),
    },
  } as Settings;
}
```

In the `queryFn`, find the line that reads and merges settings from Drive, and replace the spread pattern with `migrateSettings(loadedFromDrive)`.

**Important:** The exact lines depend on the current `useSettings.ts` content. Read the file in Step 1 before writing Step 2. The pattern to find is something like:
```ts
const merged = { ...DEFAULT_SETTINGS, ...loaded };
```
Replace with:
```ts
const merged = migrateSettings(loaded);
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSettings.ts
git commit -m "fix: migrate settings to ensure new default fields are applied for existing users

Previously new Settings fields would be missing for users with existing
settings.json on Drive until they manually reset. migrateSettings() now
fills any missing keys from DEFAULT_SETTINGS at load time."
```

---

### Task 15: Remove unused React Query persistence packages

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (auto-updated)

**Issue:** `@tanstack/react-query-persist-client` and `@tanstack/query-sync-storage-persister` are in `package.json` but unused — `providers.tsx` never wires them. They add bundle weight for zero benefit.

**Note:** If offline-first startup speed is a near-term goal, wire them up instead. The decision is: ship now with them removed, or implement persistence. Check with the user before this task if uncertain.

- [ ] **Step 1: Remove the packages**

```bash
npm uninstall @tanstack/react-query-persist-client @tanstack/query-sync-storage-persister
```

- [ ] **Step 2: Verify no imports remain**

```bash
grep -r "persist-client\|sync-storage-persister" /Users/termite/monera/src/
```
Expected: no output

- [ ] **Step 3: Type-check and run tests**

```bash
npx tsc --noEmit && npx vitest run
```
Expected: 0 errors, all PASS

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unused React Query persistence packages

@tanstack/react-query-persist-client and query-sync-storage-persister
were listed as dependencies but never wired up. Removing reduces bundle
size without behavioral change."
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 15 items from the approved plan (1a–1d, 2a–2e, 3a–3f, 4a–4c, 5a–5c) are covered by tasks 1–15. Phase 3 items 3c (budget percentage guard), 3d (memo deps), 3e (dirty flag), 3f (inline import) are all in Task 10. Phase 5d (AppDataContext decomposition) is explicitly deferred in the spec.
- [x] **No placeholders:** Every step has real code, real file paths, real commands.
- [x] **Type consistency:** `updateManualTransaction` signature matches across `useTransactions.ts`, `AppDataContext.tsx`, and the call site in `transactions/page.tsx`. `getCategoryTextClass` is defined in Task 9 step 3 and consumed in steps 5–6.
- [x] **Task 14 caveat noted:** Step 1 explicitly reads the file before writing code, because the exact merge line depends on the current `useSettings.ts` content which wasn't read during planning.
