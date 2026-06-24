# Upcoming Charges Card + Subscription Exclusion

**Date:** 2026-06-24  
**Status:** Approved for implementation

---

## Context

Monera already detects recurring subscriptions from transaction history and surfaces them in Insights → Subscriptions. It also computes bills due this period inside the safe-to-spend breakdown sheet. Two gaps exist:

- There is no at-a-glance view of what charges are coming in the next few days — users must tap into the safe-to-spend sheet to find this
- Detected subscriptions include false positives (electricity, water, regular transfers) with no way to dismiss them — these would pollute an upcoming charges card if left unaddressed

This spec covers both problems as one cohesive feature.

---

## What We Are NOT Building

- Push notifications or server-side scheduling (no backend)
- Changes to subscription detection logic (`detectSubscriptions()` is unchanged)
- Transaction splitting for ATM cash withdrawals (separate concern)

---

## Part 1 — Subscription Exclusion

### Problem

`detectSubscriptions()` flags any merchant with 3+ monthly charges within 15% amount variance. This correctly catches Netflix, but also catches utility bills and regular bank transfers that users don't consider "subscriptions."

Currently there is no way to dismiss a detected subscription. Once detected, it appears in the Subscriptions tab permanently.

### Data Model Change

**File:** `src/types/index.ts`

Add one optional field to `Settings`:

```typescript
interface Settings {
  // ... existing fields unchanged ...
  excludedSubscriptions?: string[];  // normalized subscription names the user has dismissed
}
```

**File:** `src/config/constants.ts` (DEFAULT_SETTINGS)

Add default:
```typescript
excludedSubscriptions: [],
```

This mirrors the existing `hiddenMerchants?: string[]` pattern. The migration system in `migrateSettings.ts` already handles new optional fields — it merges loaded settings with defaults, so existing users' settings files will auto-backfill `excludedSubscriptions: []` on next load. No version bump required.

The stored value is the `Subscription.name` string from `detectSubscriptions()` output (already a normalized merchant key).

### Where to Filter

Filtering happens **after** `detectSubscriptions()` runs — the detection function itself is not modified. This keeps it stateless, deterministic, and its existing tests unaffected.

Apply the exclusion filter in **three places**:

1. `src/app/(auth)/insights/_tabs/SubscriptionsTab.tsx` — before rendering detected subscriptions list
2. `src/lib/insights.ts:83` — before counting subscriptions for the insight message (see Risk section)
3. `src/components/dashboard/UpcomingChargesCard.tsx` (new) — before building the merged upcoming list

### Subscriptions Tab UI

**File:** `src/app/(auth)/insights/_tabs/SubscriptionsTab.tsx`

- Add an X icon button (`XIcon`, 16px) to the trailing edge of each detected subscription row
- Tapping calls:
  ```typescript
  updateSettings({
    ...settings,
    excludedSubscriptions: [...(settings.excludedSubscriptions ?? []), sub.name]
  })
  ```
- When `excludedSubscriptions` is non-empty, show a muted footer below the detected list:
  ```
  X subscription(s) hidden · Restore all
  ```
  Tapping "Restore all" sets `excludedSubscriptions: []`. This matches the identical UX in the Merchants tab (`hiddenMerchants`).
- No confirmation dialog — dismissal is immediately reversible via "Restore all"

### Risk: buildInsights() Counts Subscriptions Independently

**File:** `src/lib/insights.ts:83`

`buildInsights()` calls `detectSubscriptions(transactions)` on its own and generates an insight message: *"4 subscriptions cost about £100/month."* If a user excludes 2 subscriptions from the UI but this line is not updated, the insight will still say 4 — creating a contradiction.

**Fix:** Pass `excludedSubscriptions` into `buildInsights()` and filter before the insight is built:

```typescript
// insights.ts — existing call at line 83, updated:
const subs = detectSubscriptions(transactions).filter(
  (s) => !(excludedSubscriptions ?? []).includes(s.name)
);
```

`buildInsights()` already receives `settings` or individual settings fields — confirm the exact signature and thread `settings.excludedSubscriptions` through if not already present.

---

## Part 2 — Upcoming Charges Dashboard Card

### Two Data Sources

| Source | How next date is calculated | Confidence |
|---|---|---|
| Manual recurring bills (`RecurringPayment[]`) | Already computed as synthetic transactions in `safeToSpend.billItems` with exact dates from `dayOfMonth` | Exact |
| Detected subscriptions minus excluded | Inferred from `lastDate` + 1 month (see algorithm below) | Estimated |

### Next Date Estimation for Detected Subscriptions

```
dayOfMonth = day number extracted from lastDate (e.g. "2026-06-10" → 10)

if lastDate is in the current calendar month:
    nextDate = clampDay(nextMonth.year, nextMonth.month, dayOfMonth)
else:
    candidate = clampDay(currentYear, currentMonth, dayOfMonth)
    nextDate = candidate > today ? candidate : clampDay(nextMonth.year, nextMonth.month, dayOfMonth)
```

Reuse the existing `clampDay(year, month, day)` utility already in `src/lib/reports.ts`. This handles months shorter than 31 days (e.g. subscription on day 31 → Feb 28).

### Merge Algorithm

1. Take `safeInfo.billItems` already computed in the dashboard — filter to `date ≤ today + 14 days`
2. Run `detectSubscriptions(transactions)`, filter out `excludedSubscriptions`, compute `nextDate` for each
3. Filter detected subscriptions to `nextDate ≤ today + 14 days`
4. De-duplicate: if a detected subscription name matches a manual bill name (case-insensitive), keep the manual bill entry only (exact date beats estimated)
5. Sort merged list by date ascending

### New Utility Function

**File:** `src/lib/upcomingCharges.ts` (new)

```typescript
export interface UpcomingCharge {
  name: string;
  amount: number;
  date: string;        // YYYY-MM-DD
  isEstimated: boolean; // true = detected subscription, false = manual bill
  lastChargeDate?: string; // only for estimated entries, shown in tooltip
}

export function getUpcomingCharges(
  billItems: SafeToSpendBillItem[],
  subscriptions: Subscription[],
  excludedSubscriptions: string[],
  today: Date,
  windowDays: number = 14
): UpcomingCharge[]
```

Keeping this logic in a pure utility function makes it testable in isolation.

### Dashboard Placement

**File:** `src/app/(auth)/dashboard/page.tsx`

Insert the new card **after the budget donuts card** (after line 338) and **before the spending by day chart**. This leaves the 2×2 summary grid (lines 286–297) completely untouched.

```
┌─────────────────────────────┐
│  Income  │  Expenses        │  ← unchanged 2×2 grid
│  Safe    │  Savings         │
├─────────────────────────────┤
│  Budget donuts (3 cols)     │  ← unchanged
├─────────────────────────────┤
│  Upcoming charges  ← NEW    │
├─────────────────────────────┤
│  Spending by day chart      │  ← unchanged
└─────────────────────────────┘
```

The card is only rendered when the merged list is non-empty. No empty state needed — it simply disappears when there is nothing upcoming within 14 days.

### Card Design — Clarity First

The user requirement is that the card explains clearly where each number comes from. The card uses two visual treatments:

**Confirmed charge** (from manual recurring bills — exact date known):
```
Rent                 Jul 1      £900.00
```

**Estimated charge** (from detected subscription — date inferred):
```
Netflix              ~Jul 10    ~£12.99
```

The `~` prefix on both date and amount signals estimation. A single explanatory line sits at the bottom of the card:

```
~ estimated from last charge date · Set up a recurring bill for exact dates
```

The "Set up a recurring bill" text links to Settings → Bills tab so users who want certainty can convert a detected subscription into a manual bill with a precise day.

**Full card:**

```
┌─────────────────────────────────────────┐
│ Upcoming charges                        │
│ ─────────────────────────────────────── │
│ Netflix          ~Jun 28    ~£12.99     │
│ Rent              Jul 1      £900.00    │
│ Spotify          ~Jul 8     ~£9.99      │
│ ─────────────────────────────────────── │
│ ~ estimated · Add as recurring bill →   │
└─────────────────────────────────────────┘
```

- Date shown as "today" / "tomorrow" / "in N days" for entries ≤7 days out; full date string beyond that
- No tap action on manual bill rows (already visible in safe-to-spend sheet when user taps the Safe to Spend card)
- Tapping a detected subscription row (`isEstimated: true`) navigates to Insights → Subscriptions tab

### Avoiding User Confusion with Safe-to-Spend

The safe-to-spend card already shows upcoming manual bills in its drill-down sheet. Showing the same bills in the upcoming charges card could feel like double-counting.

Mitigate with a subtle note inside the safe-to-spend sheet (SafeToSpendSheet.tsx), in the "Recurring bills" section header:

> "Also shown in Upcoming charges"

This clarifies the relationship without changing the calculation.

---

## Files Changed

| File | Change | Risk |
|---|---|---|
| `src/types/index.ts` | Add `excludedSubscriptions?: string[]` to Settings | None — additive, optional |
| `src/config/constants.ts` | Add `excludedSubscriptions: []` to DEFAULT_SETTINGS | None — migration handles old files |
| `src/app/(auth)/insights/_tabs/SubscriptionsTab.tsx` | Add X dismiss button per detected sub + restore footer | Low — UI only, no calculation changes |
| `src/lib/insights.ts` | Filter detected subs by `excludedSubscriptions` before insight message | Low — only affects insight copy |
| `src/app/(auth)/dashboard/page.tsx` | Mount `<UpcomingChargesCard>` after donuts, before chart | Low — existing cards untouched |
| `src/lib/upcomingCharges.ts` | New pure utility function | None — new file |
| `src/components/dashboard/UpcomingChargesCard.tsx` | New component | None — new file |
| `src/app/(auth)/dashboard/_sheets/SafeToSpendSheet.tsx` | Add "Also shown in Upcoming charges" note to recurring bills header | None — text only |

**Files NOT changed:**
- `src/lib/reports.ts` (`detectSubscriptions` untouched)
- `src/lib/safeToSpend.ts` (untouched)
- `src/hooks/useSettings.ts` (untouched)
- All existing tests (pass as-is)

---

## Verification

1. **Exclusion persists** — dismiss a detected subscription, close and reopen app, confirm it stays dismissed in both the Subscriptions tab and the upcoming charges card
2. **Insights message updates** — after dismissing a subscription, the "N subscriptions cost £X/month" insight reflects the new count
3. **Restore works** — tap "Restore all", dismissed subscriptions reappear in both places
4. **Estimated dates** — subscription with `lastDate = "2026-06-10"`: if today is June 24, card shows `~Jul 10`
5. **De-duplication** — if Netflix exists as both a detected subscription and a manual bill, only the manual entry (exact date, no `~`) appears
6. **Manual bills exact** — manual bill with `dayOfMonth = 28` and today = June 24 shows Jun 28 with no `~`
7. **Card hidden when empty** — when no charges fall within 14 days, the card does not render; existing dashboard layout is unchanged
8. **Dashboard grid intact** — the 2×2 summary card grid renders identically before and after
9. **Safe-to-spend calculation unchanged** — tapping the Safe to Spend card shows the same breakdown as before
10. **All existing tests pass** — `reports.test.ts`, `safeToSpend.test.ts`, `settings.test.ts` require no changes
