# Upcoming Charges Card + Subscription Exclusion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dashboard card showing charges due in the next 14 days, and let users dismiss false-positive detected subscriptions.

**Architecture:** Pure additive changes — a new optional Settings field, a new pure utility, a new component, and targeted edits to SubscriptionsTab and buildInsights. `detectSubscriptions()` and `computeSafeToSpend()` are untouched. Filtering happens at display time, not inside detection functions.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Vitest, shadcn/ui (Card, CardHeader, CardContent), lucide-react icons.

## Global Constraints

- Never modify `detectSubscriptions()` in `src/lib/reports.ts` — it must remain a pure, unchanged function.
- Never modify `computeSafeToSpend()` in `src/lib/safeToSpend.ts`.
- All existing tests in `src/__tests__/` must continue to pass without modification.
- Do not commit until the user has reviewed the changes.
- Follow the existing `updateSettings({ ...settings, field: value })` spread pattern for settings mutations.
- `clampDay` in `src/lib/recurring.ts` is not exported — do not import it; implement equivalent logic inline.
- Match existing card styling: `rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]`.
- Run tests with: `npx vitest run`

---

### Task 1: Add `excludedSubscriptions` to Settings type and defaults

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/config/constants.ts`
- Test: `src/__tests__/settings.test.ts`

**Interfaces:**
- Produces: `Settings.excludedSubscriptions?: string[]` — used by Tasks 2, 3, 4, 5

- [ ] **Step 1: Write a failing test**

Open `src/__tests__/settings.test.ts` and add this test at the end of the `describe` block (before the closing `}`):

```typescript
it("backfills excludedSubscriptions to [] when missing", () => {
  const { settings, changed } = migrateSettings({} as Settings);
  expect(settings.excludedSubscriptions).toEqual([]);
  expect(changed).toBe(true);
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run src/__tests__/settings.test.ts
```

Expected: FAIL — `settings.excludedSubscriptions` is `undefined`, not `[]`.

- [ ] **Step 3: Add the field to the Settings interface**

In `src/types/index.ts`, after line 61 (`hiddenMerchants?: string[];`), add:

```typescript
  /** Detected subscription names the user has dismissed — does not affect calculations. */
  excludedSubscriptions?: string[];
```

- [ ] **Step 4: Add the default value**

In `src/config/constants.ts`, after the `onboarded: false,` line inside `DEFAULT_SETTINGS`, add:

```typescript
  excludedSubscriptions: [] as string[],
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx vitest run src/__tests__/settings.test.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Run the full test suite to confirm no regressions**

```bash
npx vitest run
```

Expected: All tests PASS.

---

### Task 2: Filter excluded subscriptions inside `buildInsights()`

**Files:**
- Modify: `src/lib/insights.ts`
- Test: `src/__tests__/insights.test.ts`

**Interfaces:**
- Consumes: `Settings.excludedSubscriptions?: string[]` from Task 1
- Produces: `buildInsights()` subscription insight now reflects excluded subscriptions

- [ ] **Step 1: Write a failing test**

Open `src/__tests__/insights.test.ts` and add this test inside the `describe("buildInsights")` block:

```typescript
it("excludes dismissed subscriptions from the subscription insight", () => {
  const subsTx = [
    tx({ amount: 9.99, type: "expense", description: "Spotify", date: "2024-04-01" }),
    tx({ amount: 9.99, type: "expense", description: "Spotify", date: "2024-05-01" }),
    tx({ amount: 9.99, type: "expense", description: "Spotify", date: "2024-06-01" }),
  ];
  const settingsWithExclusion: Settings = { ...settings, excludedSubscriptions: ["Spotify"] };
  const ins = buildInsights(subsTx, settingsWithExclusion, "2024-06", summaryOf({ income: 1000 }), noAlloc);
  expect(ins.some((i) => i.id === "subs")).toBe(false);
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run src/__tests__/insights.test.ts
```

Expected: FAIL — "subs" insight is still present even when Spotify is excluded.

- [ ] **Step 3: Update `buildInsights()` to filter excluded subscriptions**

In `src/lib/insights.ts`, replace line 83 (`const subs = detectSubscriptions(transactions);`) with:

```typescript
  const subs = detectSubscriptions(transactions).filter(
    (s) => !(settings.excludedSubscriptions ?? []).includes(s.name)
  );
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/__tests__/insights.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Run the full test suite**

```bash
npx vitest run
```

Expected: All tests PASS.

---

### Task 3: Add dismiss UI to SubscriptionsTab and wire up the insights page

**Files:**
- Modify: `src/app/(auth)/insights/_tabs/SubscriptionsTab.tsx`
- Modify: `src/app/(auth)/insights/page.tsx`

**Interfaces:**
- Consumes: `Settings.excludedSubscriptions?: string[]` from Task 1
- Consumes: `updateSettings` already available in insights page via `useAppData()`
- Produces: `SubscriptionsTab` accepts new props `excludedSubCount`, `onExclude`, `onRestore`

- [ ] **Step 1: Update the Props interface in SubscriptionsTab**

In `src/app/(auth)/insights/_tabs/SubscriptionsTab.tsx`, replace the `interface Props` block (lines 46–51) with:

```typescript
interface Props {
  recurringPayments: RecurringPayment[];
  subscriptions: Subscription[];   // already filtered — excluded subs removed by parent
  transactions: Transaction[];
  paydayOfMonth: number;
  excludedSubCount: number;        // how many detected subs are currently hidden
  onExclude: (name: string) => void;
  onRestore: () => void;
}
```

- [ ] **Step 2: Destructure the new props in the component function**

Replace the function signature line:

```typescript
export function SubscriptionsTab({ recurringPayments, subscriptions, transactions, paydayOfMonth }: Props) {
```

with:

```typescript
export function SubscriptionsTab({ recurringPayments, subscriptions, transactions, paydayOfMonth, excludedSubCount, onExclude, onRestore }: Props) {
```

- [ ] **Step 3: Add the X icon import**

In `src/app/(auth)/insights/_tabs/SubscriptionsTab.tsx`, update the lucide-react import line from:

```typescript
import { ChevronDown, CalendarClock, CreditCard } from "lucide-react";
```

to:

```typescript
import { ChevronDown, CalendarClock, CreditCard, X } from "lucide-react";
```

- [ ] **Step 4: Add the dismiss button to each detected subscription row**

In the detected subscriptions section, find the `<button>` that wraps each subscription row (the one with `onClick={() => setExpandedSub(isOpen ? null : s.name)}`). After the `<ChevronDown .../>` element and before the closing `</button>`, add the dismiss button:

```tsx
<button
  onClick={(e) => { e.stopPropagation(); onExclude(s.name); }}
  className="p-1 text-muted-foreground/40 hover:text-destructive transition-colors shrink-0"
  aria-label={`Hide ${s.name}`}
>
  <X size={13} />
</button>
```

- [ ] **Step 5: Add the restore footer below the detected subscriptions list**

In `src/app/(auth)/insights/_tabs/SubscriptionsTab.tsx`, find the closing `</CardContent>` of the Detected Subscriptions card. Just before it (after the `)}` that closes the `subscriptions.length === 0` ternary), add:

```tsx
{excludedSubCount > 0 && (
  <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
    {excludedSubCount} hidden ·{" "}
    <button
      onClick={onRestore}
      className="underline hover:text-foreground transition-colors"
    >
      Restore all
    </button>
  </p>
)}
```

- [ ] **Step 6: Update the insights page to filter subscriptions and wire callbacks**

In `src/app/(auth)/insights/page.tsx`, replace line 101:

```typescript
const subscriptions = useMemo(() => detectSubscriptions(transactions), [transactions]);
```

with:

```typescript
const allSubscriptions = useMemo(() => detectSubscriptions(transactions), [transactions]);
const subscriptions = useMemo(
  () => allSubscriptions.filter((s) => !(settings.excludedSubscriptions ?? []).includes(s.name)),
  [allSubscriptions, settings.excludedSubscriptions]
);
const excludedSubCount = allSubscriptions.length - subscriptions.length;
```

- [ ] **Step 7: Pass the new props to SubscriptionsTab**

In `src/app/(auth)/insights/page.tsx`, find the `<SubscriptionsTab .../>` JSX (around line 154). Replace it with:

```tsx
<SubscriptionsTab
  recurringPayments={settings.recurringPayments ?? []}
  subscriptions={subscriptions}
  transactions={transactions}
  paydayOfMonth={paydayOfMonth}
  excludedSubCount={excludedSubCount}
  onExclude={(name) =>
    updateSettings({
      ...settings,
      excludedSubscriptions: [...(settings.excludedSubscriptions ?? []), name],
    })
  }
  onRestore={() => updateSettings({ ...settings, excludedSubscriptions: [] })}
/>
```

- [ ] **Step 8: Run the full test suite to confirm no regressions**

```bash
npx vitest run
```

Expected: All tests PASS. (No unit tests for the UI layer — verified manually in Task 5's verification.)

---

### Task 4: Create `getUpcomingCharges()` pure utility

**Files:**
- Create: `src/lib/upcomingCharges.ts`
- Create: `src/__tests__/upcomingCharges.test.ts`

**Interfaces:**
- Consumes: `SafeToSpendBillItem` from `src/lib/safeToSpend.ts`
- Consumes: `Subscription` from `src/lib/reports.ts`
- Produces:
  ```typescript
  interface UpcomingCharge {
    name: string;
    amount: number;
    date: string;           // YYYY-MM-DD
    isEstimated: boolean;
    lastChargeDate?: string; // only when isEstimated is true
  }
  function getUpcomingCharges(
    billItems: SafeToSpendBillItem[],
    subscriptions: Subscription[],  // already filtered — excluded subs removed by caller
    today: Date,
    windowDays?: number             // default 14
  ): UpcomingCharge[]
  ```

- [ ] **Step 1: Write the test file**

Create `src/__tests__/upcomingCharges.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getUpcomingCharges } from "@/lib/upcomingCharges";
import type { SafeToSpendBillItem } from "@/lib/safeToSpend";
import type { Subscription } from "@/lib/reports";

const TODAY = new Date("2026-06-24T12:00:00");

function bill(name: string, date: string, amount: number): SafeToSpendBillItem {
  return { name, date, amount };
}

function sub(name: string, lastDate: string, amount: number): Subscription {
  return { name, amount, total: amount * 3, months: 3, lastDate };
}

describe("getUpcomingCharges", () => {
  it("includes a manual bill due within the window", () => {
    const result = getUpcomingCharges([bill("Rent", "2026-06-28", 900)], [], TODAY);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "Rent", amount: 900, isEstimated: false, date: "2026-06-28" });
  });

  it("excludes a manual bill beyond the 14-day window", () => {
    const result = getUpcomingCharges([bill("Rent", "2026-07-10", 900)], [], TODAY);
    expect(result).toHaveLength(0);
  });

  it("estimates next date for a subscription charged last month", () => {
    // lastDate = May 10 → next expected = Jun 10, which has passed → Jul 10
    const result = getUpcomingCharges([], [sub("Netflix", "2026-05-10", 12.99)], TODAY);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: "Netflix",
      isEstimated: true,
      date: "2026-07-10",
      lastChargeDate: "2026-05-10",
    });
  });

  it("estimates next date as this month when not yet passed", () => {
    // lastDate = May 28 → next expected = Jun 28, which hasn't passed yet (today = Jun 24)
    const result = getUpcomingCharges([], [sub("Spotify", "2026-05-28", 9.99)], TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-06-28");
  });

  it("estimates next month when subscription already charged this month", () => {
    // lastDate = Jun 10 (this month already) → next = Jul 10
    const result = getUpcomingCharges([], [sub("Spotify", "2026-06-10", 9.99)], TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-07-10");
  });

  it("de-duplicates when same name appears in both sources — prefers manual bill", () => {
    const bills = [bill("Netflix", "2026-06-28", 12.99)];
    const subs = [sub("Netflix", "2026-05-28", 12.99)];
    const result = getUpcomingCharges(bills, subs, TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].isEstimated).toBe(false);
  });

  it("sorts results by date ascending", () => {
    const result = getUpcomingCharges(
      [bill("Rent", "2026-07-01", 900)],
      [sub("Spotify", "2026-05-28", 9.99)],
      TODAY
    );
    expect(result[0].name).toBe("Spotify"); // Jun 28 before Jul 1
    expect(result[1].name).toBe("Rent");
  });

  it("clamps day 31 in a 30-day month", () => {
    // Sub charged on May 31 → next: Jun 30 (June has 30 days, today is Jun 24)
    const result = getUpcomingCharges([], [sub("X", "2026-05-31", 5)], TODAY);
    expect(result[0].date).toBe("2026-06-30");
  });

  it("returns empty array when nothing falls within the window", () => {
    const result = getUpcomingCharges([], [], TODAY);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run src/__tests__/upcomingCharges.test.ts
```

Expected: FAIL — module `@/lib/upcomingCharges` not found.

- [ ] **Step 3: Create the utility**

Create `src/lib/upcomingCharges.ts`:

```typescript
import type { SafeToSpendBillItem } from "@/lib/safeToSpend";
import type { Subscription } from "@/lib/reports";

export interface UpcomingCharge {
  name: string;
  amount: number;
  date: string;            // YYYY-MM-DD
  isEstimated: boolean;
  lastChargeDate?: string; // only when isEstimated is true
}

/** YYYY-MM-DD string for today (no time component). */
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Clamp day to the last day of the given month (month is 1-indexed). */
function clampedDateStr(year: number, month: number, day: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  const clamped = Math.min(day, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
}

/**
 * Estimate the next charge date for a detected subscription.
 * Logic:
 *   - If lastDate is in the current calendar month → next is same day next month.
 *   - Otherwise: if same day this month hasn't passed yet → return it.
 *                else → return same day next month.
 */
function estimateNextDate(lastDate: string, today: Date): string {
  const lastYear = parseInt(lastDate.slice(0, 4), 10);
  const lastMonth = parseInt(lastDate.slice(5, 7), 10); // 1-indexed
  const day = parseInt(lastDate.slice(8, 10), 10);

  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1; // 1-indexed
  const todayStr = toDateStr(today);

  // Already charged this calendar month → next charge is next month
  if (lastYear === todayYear && lastMonth === todayMonth) {
    let nextYear = todayYear;
    let nextMonth = todayMonth + 1;
    if (nextMonth > 12) { nextMonth = 1; nextYear++; }
    return clampedDateStr(nextYear, nextMonth, day);
  }

  // Not charged this month yet — check if this month's date is still upcoming
  const thisMonthCandidate = clampedDateStr(todayYear, todayMonth, day);
  if (thisMonthCandidate > todayStr) {
    return thisMonthCandidate;
  }

  // This month's date has already passed → next month
  let nextYear = todayYear;
  let nextMonth = todayMonth + 1;
  if (nextMonth > 12) { nextMonth = 1; nextYear++; }
  return clampedDateStr(nextYear, nextMonth, day);
}

/**
 * Returns the merged, sorted list of upcoming charges within the next `windowDays`
 * days (default 14). Manual recurring bills take priority over detected
 * subscriptions when the same name appears in both sources.
 *
 * @param billItems   - From safeToSpend.billItems (manual bills, date > today)
 * @param subscriptions - Detected subscriptions with excludedSubscriptions already filtered out
 * @param today       - Injected so the result is deterministic in tests
 * @param windowDays  - How many days ahead to look (default 14)
 */
export function getUpcomingCharges(
  billItems: SafeToSpendBillItem[],
  subscriptions: Subscription[],
  today: Date,
  windowDays = 14
): UpcomingCharge[] {
  const todayStr = toDateStr(today);
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + windowDays);
  const windowEndStr = toDateStr(windowEnd);

  // Manual bills: already have exact dates, keep those within the window
  const manualCharges: UpcomingCharge[] = billItems
    .filter((b) => b.date > todayStr && b.date <= windowEndStr)
    .map((b) => ({ name: b.name, amount: b.amount, date: b.date, isEstimated: false }));

  const manualNames = new Set(manualCharges.map((c) => c.name.toLowerCase()));

  // Detected subscriptions: estimate next date, filter to window, skip if manual bill covers it
  const detectedCharges: UpcomingCharge[] = subscriptions
    .map((s) => ({ s, nextDate: estimateNextDate(s.lastDate, today) }))
    .filter(({ nextDate }) => nextDate > todayStr && nextDate <= windowEndStr)
    .filter(({ s }) => !manualNames.has(s.name.toLowerCase()))
    .map(({ s, nextDate }) => ({
      name: s.name,
      amount: s.amount,
      date: nextDate,
      isEstimated: true,
      lastChargeDate: s.lastDate,
    }));

  return [...manualCharges, ...detectedCharges].sort((a, b) => a.date.localeCompare(b.date));
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/__tests__/upcomingCharges.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Run the full test suite**

```bash
npx vitest run
```

Expected: All tests PASS.

---

### Task 5: Create `UpcomingChargesCard` component and mount it on the dashboard

**Files:**
- Create: `src/components/dashboard/UpcomingChargesCard.tsx`
- Modify: `src/app/(auth)/dashboard/page.tsx`
- Modify: `src/app/(auth)/dashboard/_sheets/SafeToSpendSheet.tsx`

**Interfaces:**
- Consumes: `UpcomingCharge[]` and `getUpcomingCharges()` from Task 4
- Consumes: `Subscription` and `detectSubscriptions()` from `src/lib/reports.ts`
- Consumes: `safeInfo.billItems` (already computed in dashboard page)
- Consumes: `settings.excludedSubscriptions` from Task 1

- [ ] **Step 1: Create the UpcomingChargesCard component**

Create `src/components/dashboard/UpcomingChargesCard.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { UpcomingCharge } from "@/lib/upcomingCharges";

interface Props {
  charges: UpcomingCharge[];
  currency: string;
}

function relativeDate(dateStr: string): string {
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(dateStr + "T00:00:00");
  const diffDays = Math.round((target.getTime() - todayMidnight.getTime()) / 86400000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays <= 7) return `in ${diffDays} days`;
  return formatDate(dateStr);
}

export function UpcomingChargesCard({ charges, currency }: Props) {
  const router = useRouter();

  if (charges.length === 0) return null;

  const hasEstimated = charges.some((c) => c.isEstimated);

  return (
    <Card className="rounded-2xl border-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <CalendarClock size={13} /> Upcoming charges
        </CardTitle>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">Next 14 days</p>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex flex-col divide-y divide-border">
          {charges.map((charge, i) => (
            <div
              key={`${charge.name}-${charge.date}-${i}`}
              className={cn(
                "flex items-center gap-3 py-2.5 first:pt-0 last:pb-0",
                charge.isEstimated &&
                  "cursor-pointer hover:bg-secondary/50 -mx-4 px-4 rounded transition-colors"
              )}
              onClick={
                charge.isEstimated ? () => router.push("/insights") : undefined
              }
              role={charge.isEstimated ? "button" : undefined}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{charge.name}</p>
                <p className="text-xs text-muted-foreground">
                  {charge.isEstimated
                    ? `estimated · last charged ${formatDate(charge.lastChargeDate!)}`
                    : "recurring bill"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium tabular-nums font-mono text-foreground">
                  {charge.isEstimated ? "~" : ""}
                  {formatCurrency(charge.amount, currency)}
                </p>
                <p className="text-xs text-muted-foreground">{relativeDate(charge.date)}</p>
              </div>
            </div>
          ))}
        </div>
        {hasEstimated && (
          <p className="text-[11px] text-muted-foreground/70 mt-3 pt-3 border-t border-border">
            ~ estimated from last charge date ·{" "}
            <button
              className="underline hover:text-foreground transition-colors"
              onClick={() => router.push("/settings")}
            >
              Add as recurring bill
            </button>{" "}
            for exact dates
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add the necessary imports to the dashboard page**

In `src/app/(auth)/dashboard/page.tsx`, add these imports after the existing import block:

```typescript
import { detectSubscriptions } from "@/lib/reports";
import { getUpcomingCharges } from "@/lib/upcomingCharges";
import { UpcomingChargesCard } from "@/components/dashboard/UpcomingChargesCard";
```

- [ ] **Step 3: Compute `upcomingCharges` in the dashboard page**

In `src/app/(auth)/dashboard/page.tsx`, after the line that computes `safeInfo` (find `computeSafeToSpend(`), add:

```typescript
  const allSubscriptions = useMemo(() => detectSubscriptions(transactions), [transactions]);
  const upcomingCharges = useMemo(
    () =>
      getUpcomingCharges(
        safeInfo.billItems,
        allSubscriptions.filter(
          (s) => !(settings.excludedSubscriptions ?? []).includes(s.name)
        ),
        new Date()
      ),
    [safeInfo.billItems, allSubscriptions, settings.excludedSubscriptions]
  );
```

- [ ] **Step 4: Mount the card in the JSX between donuts and chart**

In `src/app/(auth)/dashboard/page.tsx`, find the comment `{/* Weekday spending chart */}` (around line 340). Insert the card directly before that comment:

```tsx
        {/* Upcoming charges */}
        <UpcomingChargesCard
          charges={upcomingCharges}
          currency={settings.currency ?? "€"}
        />
```

- [ ] **Step 5: Add clarifying note to SafeToSpendSheet**

In `src/app/(auth)/dashboard/_sheets/SafeToSpendSheet.tsx`, find line 51:

```tsx
            <p className="text-xs font-medium text-muted-foreground mb-1.5 px-1">Recurring bills</p>
```

Replace it with:

```tsx
            <p className="text-xs font-medium text-muted-foreground mb-1.5 px-1">
              Recurring bills{" "}
              <span className="font-normal text-muted-foreground/60">· also in Upcoming charges</span>
            </p>
```

- [ ] **Step 6: Run the full test suite**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 7: Manual verification checklist**

Start the dev server and check each item:

```bash
npm run dev
```

1. **Card hidden when empty** — open the app with no subscriptions and no manual bills due in 14 days. The card does not appear between donuts and chart.
2. **Manual bill shows** — add a recurring bill in Settings → Bills with a day of month 3–14 days from now. Card appears with exact date, no `~`, subtitle says "recurring bill".
3. **Detected subscription shows** — if there are detected subscriptions whose `lastDate` puts the next charge within 14 days, they appear with `~` prefix on amount and date, subtitle says "estimated · last charged [date]".
4. **Tap detected sub** — tapping a detected subscription row navigates to `/insights`.
5. **Dismiss subscription** — in Insights → Subscriptions tab, tap the X on a detected subscription. It disappears from the list. The card on the dashboard also no longer shows it.
6. **Restore** — tap "Restore all" in the Subscriptions tab. The dismissed subscription reappears in both the tab and the dashboard card.
7. **Insights message updated** — after dismissing "Spotify", the "N subscriptions cost..." insight in the Overview tab no longer counts Spotify.
8. **Safe-to-spend sheet** — tap the Safe to Spend card. The recurring bills list header now reads "Recurring bills · also in Upcoming charges".
9. **De-duplication** — a subscription that also exists as a manual recurring bill only appears once in the card (as the manual bill, with no `~`).
10. **2×2 summary grid unchanged** — Income / Expenses / Safe to Spend / Savings cards render exactly as before.
11. **All existing tests pass** — `npx vitest run` shows 0 failures.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Covered by |
|---|---|
| `excludedSubscriptions?: string[]` in Settings | Task 1 |
| Default `[]` backfilled for existing users | Task 1 (DEFAULT_SETTINGS) |
| `buildInsights()` filters excluded subs | Task 2 |
| X button on each detected subscription row | Task 3 Step 4 |
| Restore all footer | Task 3 Step 5 |
| Filter in insights page before passing to SubscriptionsTab | Task 3 Step 6 |
| `getUpcomingCharges()` pure utility with both sources | Task 4 |
| 14-day window | Task 4 (`windowDays = 14`) |
| De-duplication (manual beats detected) | Task 4 Step 3 |
| `isEstimated` flag + `lastChargeDate` | Task 4 |
| `clampedDateStr` for short months | Task 4 |
| `UpcomingChargesCard` component | Task 5 Step 1 |
| Card placed between donuts and chart | Task 5 Step 4 |
| Card hidden when empty | Task 5 Step 1 (`if charges.length === 0 return null`) |
| `~` prefix on estimated amount and date | Task 5 Step 1 |
| "estimated · last charged [date]" subtitle | Task 5 Step 1 |
| "Add as recurring bill" link | Task 5 Step 1 |
| Tap detected sub → navigate to Insights | Task 5 Step 1 |
| SafeToSpendSheet note | Task 5 Step 5 |
| `detectSubscriptions()` unchanged | Not modified in any task ✓ |
| `computeSafeToSpend()` unchanged | Not modified in any task ✓ |

**No placeholders found.**

**Type consistency:** `UpcomingCharge` is defined once in `src/lib/upcomingCharges.ts` and imported by both `UpcomingChargesCard` and `src/app/(auth)/dashboard/page.tsx`. `Subscription` type imported from `src/lib/reports.ts` throughout. `SafeToSpendBillItem` imported from `src/lib/safeToSpend.ts` throughout.
