# Monera

> Personal finance that lives in your Google Drive — not on someone else's server.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)](https://www.typescriptlang.org)

Monera turns your Revolut exports into a clear monthly picture of where your money goes. Import a CSV or Excel statement, set your payday, and get budgets, spending breakdowns, merchant analytics, subscription detection, and plain-language insights — with every byte stored in a private folder in **your own Google Drive**.

There is no Monera backend, no database, and no account data on any third-party server.

---

## Features

| | |
|---|---|
| **Your data, your Drive** | All data lives in a `Monera/` folder you own. The app uses the minimal `drive.file` scope — it can only see files it created. |
| **Payday-aware budgets** | Periods run payday-to-payday (e.g. the 24th), not calendar months. Override income and the needs / wants / savings split per period. |
| **Import CSV or Excel** | Drop in a Revolut `.csv` or `.xlsx` export (up to 25 MB). Excel files are converted in the browser — nothing leaves your machine until it hits Drive. Transactions are dated by when you tapped the card, not when the bank settled. Pending transactions are imported too (settlement can take days) — only declined, failed, or reverted ones are skipped. |
| **Smart categorization** | Keyword rules (case-insensitive, partial-match) auto-categorize transactions. Re-categorizing one transaction applies the same category to similar ones, saves a reusable rule, and offers a one-tap undo. Per-transaction overrides are remembered and always win. |
| **Powerful transaction list** | Separate Expenses, Savings, Income and All lists, so the Expenses total always matches the dashboard's Spent. Multi-column sort, category filter, custom date ranges, and full-text search scoped to the selected period — all persisted across navigation. Export what's on screen as CSV. Keyboard shortcuts: `/` jumps to search, `Esc` clears a selection. Large lists load 50 transactions at a time. |
| **Bulk editing & undo** | Inline checkboxes let you multi-select transactions to exclude, re-categorize, or reset to rule defaults. Every change — leaving out, counting again, moving category, deleting a manual entry — can be undone for a few seconds. |
| **Reports & insights** | A forecast of what's likely left at payday at your current pace (with a warning if Needs or Wants is heading over), a comparison with last period up to the same day, savings rate against your own target, top merchants, and subscription detection (optional spending charged about once a month at a steady price). |
| **Tappable drill-downs** | Every figure traces to its transactions: tap a dashboard card, a budget circle, or any chart bar — including a specific weekday, month, or year — to see the exact transactions and the calculation behind it. |
| **Spending by day** | Switch the weekday chart between Week, Month, Period, and Year ranges. Each mode shows 7 bars (Mon–Sun) aggregated over the selected window, with a dedicated month picker for the Month view. Hovering a bar and tapping into its drill-down both show the same Spent / Received / Net breakdown, and only transactions that have actually happened are counted — recurring bills or manual entries dated in the future never inflate the total. |
| **Year overview** | The Year tab shows spending (Needs and Wants) for each payday period across the calendar year, with the running period highlighted, spent and saved totals for the year, and click-through to any period on the dashboard. |
| **Safe to spend** | Forward-looking card that shows what you can still spend before payday — after money spent so far, savings set aside, and bills still due this period. The Needs and Wants circles add up to it exactly. |
| **Budget circles** | One ring per category showing what's left. Savings only counts money actually moved, never a transfer that's still scheduled. An "Over budget" or "Target met" badge appears only when it's true. |
| **Upcoming bills** | Dashboard card listing everything due before payday — recurring bills with exact dates and estimated charges from detected subscriptions. Pin an estimated charge as a bill for an exact date. |
| **Simple, clear wording** | Every number has a short plain label and nothing more. A replayable guided tour explains each page on first visit. |
| **Accessible** | Full keyboard navigation with visible focus, labelled controls for screen readers, WCAG AA colour contrast, 44px tap targets on phones, and reduced-motion support. |
| **Mobile-first account controls** | On mobile, the Settings page shows your Google account name, photo, and a Sign out button at the very top — no scrolling required. Sign-out clears the session and all cached data. |
| **Recurring payments** | Track fixed payments paid outside Revolut (rent, insurance, savings transfers, etc). They appear as synthetic transactions in every period and count toward your budget — but only once their date arrives. Future-dated occurrences stay visible (e.g. in the transaction list, marked as upcoming) without being counted in any total until they've actually happened. Configured under Settings → Bills, with support for any spending category including Savings. A one-time nudge after the first successful import prompts the user to set these up. |
| **Duplicate-safe imports** | Re-uploading the same statement never creates duplicates. Two genuinely identical same-day purchases are both preserved. |
| **Fast & optimistic** | Data is cached in-memory (TanStack Query) and revalidated in the background. Edits apply immediately and roll back automatically on failure. Stale category overrides are pruned on load. Installable PWA. |
| **Resilient error recovery** | If loading fails, every page says why in plain words — offline, Google sign-in expired, or Drive trouble — with the one action that fixes it ("Try again" or "Sign in again"). An offline banner appears when the connection drops. React error boundaries catch unexpected render errors so the app degrades gracefully rather than going blank. |
| **Multiple income sources** | Salary keywords identify salary-type transactions for display. Configured salary basis (from Settings) and all detected income are always summed — so income from multiple employers and side jobs are counted together. |

---

## Tech Stack

| Area | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) + React 19 |
| Auth | [NextAuth v5](https://authjs.dev) — Google OAuth, JWT sessions |
| Storage | Google Drive REST API (`drive.file` scope) |
| Data layer | [TanStack Query v5](https://tanstack.com/query) — in-memory cache with optimistic updates |
| Styling | Tailwind CSS v4, shadcn/ui (Radix), Framer Motion |
| Charts | Recharts |
| Spreadsheets | SheetJS (lazy-loaded for `.xlsx` uploads) |
| Testing | Vitest |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A Google Cloud project with an OAuth 2.0 Client ID (Web application type)

### 1 — Configure Google OAuth

In the [Google Cloud Console](https://console.cloud.google.com/):

1. Enable the **Google Drive API**.
2. Set up the **OAuth consent screen** — name it *Monera*, add the `drive.file` scope, and add yourself as a **Test user** while in testing mode.
3. Create an **OAuth 2.0 Client ID** (Web application) and add the redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://your-domain/api/auth/callback/google` (production)

### 2 — Environment variables

Create `.env.local` at the project root:

```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
NEXTAUTH_SECRET=        # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
```

### 3 — Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with Google.

> **Note:** The `xlsx` package is fetched from SheetJS's CDN on first install — `npm install` requires network access to `cdn.sheetjs.com`.

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── dashboard/
│   │   │   ├── page.tsx         # Dashboard — summary cards, budget donuts, weekday chart
│   │   │   └── _sheets/         # Drill-down sheet components (income, expenses, savings…)
│   │   ├── insights/
│   │   │   ├── page.tsx         # Insights — tab switcher and shared data memos
│   │   │   └── _tabs/           # Tab components (Overview, Merchants, Subscriptions, Year)
│   │   ├── transactions/
│   │   │   ├── page.tsx         # Transaction list — sort, filter, bulk actions
│   │   │   └── _components/     # Filter bar and bulk action bar
│   │   ├── upload/              # CSV / XLSX import
│   │   └── settings/            # Budget, income, recurring payments, categorisation rules
│   ├── login/                   # Sign-in screen
│   └── api/auth/                # NextAuth route handler
├── components/                  # Shared UI, charts, layout, budget widgets, onboarding
├── contexts/                    # AppDataContext — central state and mutations
├── hooks/                       # useDrive, useTransactions, useSettings, useBudget …
├── lib/
│   ├── finance.ts               # Single source of truth for period spend and refund netting
│   ├── reports.ts               # Analytics, subscription detection
│   ├── insights.ts              # Plain-language insight generation
│   ├── safeToSpend.ts           # Forward-looking "safe to spend" calculation
│   ├── forecast.ts              # Where Needs and Wants land by payday at the current pace
│   ├── migrateSettings.ts       # Version-aware settings migration (fills missing defaults on load)
│   ├── parser/                  # CSV / XLSX parsing and date handling
│   ├── spreadsheet.ts           # XLSX → CSV conversion
│   └── google/                  # Drive API wrappers and folder helpers
└── types/                       # Shared TypeScript types
```

Page files stay lean by delegating their large content sections to co-located `_sheets/`, `_tabs/`, and `_components/` directories. Shared components that are used across multiple pages live in `src/components/`.

### Drive folder layout

```
Monera/
├── revolut-exports/     # Uploaded CSV statements
└── app-data/            # settings.json, category-rules.json,
                         # category-overrides.json, manual-transactions.json,
                         # excluded-transactions.json, parse-cache.json
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Lint with ESLint |
| `npm test` | Run the test suite (Vitest) |

---

## Privacy & Security

- **No server-side storage.** Data never leaves your Google Drive. Monera has no backend database.
- **No browser storage of financial data.** Transaction data is kept only in memory during the session — nothing is written to localStorage or IndexedDB. Only transaction-list filter preferences are stored, in sessionStorage, which clears when the tab closes.
- **Minimal OAuth scope.** `drive.file` grants access only to the files Monera creates — it cannot read the rest of your Drive.
- **Persistent sessions.** Google OAuth is configured to always issue a refresh token, so the app silently renews the 1-hour access token in the background — users stay signed in without being interrupted.
- **HttpOnly session cookies.** Access and refresh tokens are stored in a server-side httpOnly cookie and are never exposed to JavaScript or logged.
- **No third-party sharing of personal data.** Authentication and storage are handled entirely by Google. The only other third party is Vercel Analytics, which receives anonymous, aggregated usage metrics (page views, performance) — never your name, email, or financial data.
- **Google API Limited Use.** Monera's use of data received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. See the in-app [privacy policy](src/app/privacy/page.tsx) for the full per-data-item disclosure.

---

## Deployment

Monera deploys to [Vercel](https://vercel.com) without any configuration beyond setting environment variables:

1. Import the repository in Vercel.
2. Add the four environment variables from step 2 above.
3. Add your production callback URL (`https://your-domain/api/auth/callback/google`) to the Google OAuth client.

The app builds with `next build` and runs as a standard serverless Next.js application.

---

## Testing

```bash
npm test
```

The test suite covers the financial logic that matters most: refund netting and dashboard/reports consistency, payday-aware period math, CSV/XLSX parsing, deduplication, categorization, income reconciliation (including salary keyword and multi-employer scenarios), subscription detection, upcoming charge estimation, payday forecasts, plain-language load-error messages, settings migration, and the insights engine.

---

## License

Licensed under the [GNU Affero General Public License v3.0](LICENSE).
