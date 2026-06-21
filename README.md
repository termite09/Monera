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
| **Import CSV or Excel** | Drop in a Revolut `.csv` or `.xlsx` export (up to 25 MB). Excel files are converted in the browser — nothing leaves your machine until it hits Drive. Transactions are dated by when you tapped the card, not when the bank settled. |
| **Smart categorization** | Keyword rules (case-insensitive, partial-match) auto-categorize transactions. Re-categorizing one transaction applies the same category to similar ones, saves a reusable rule, and offers a one-tap undo. Per-transaction overrides are remembered and always win. |
| **Powerful transaction list** | Multi-column sort (date, description, category, amount), category and type filters, custom date ranges, and full-text search — all persisted across navigation. Descriptions always wrap, never truncate. |
| **Bulk editing** | Inline checkboxes let you multi-select transactions to exclude or re-categorize many at once. |
| **Reports & insights** | Budget-vs-actual, month-over-month comparison (category by category), spending pace and projection, top merchants, most-frequent merchants, stricter subscription detection (recurring amount _and_ cadence), and a prioritized insights feed. |
| **Tappable drill-downs** | Every figure traces to its transactions: tap a dashboard card, a budget circle, or any chart bar — including a specific weekday, month, or year — to see the exact transactions and the calculation behind it. |
| **Spending by day** | Switch the weekday chart between Week, Month, Period, and Year ranges, with a dedicated month picker, so you can compare any time window at a glance. |
| **Guidance built in** | Every number carries a plain-English info tooltip, and a replayable guided tour explains each page on first visit. |
| **Recurring payments** | Track fixed bills paid outside Revolut. They appear as synthetic transactions in every period and count toward your budget. |
| **Duplicate-safe imports** | Re-uploading the same statement never creates duplicates. Two genuinely identical same-day purchases are both preserved. |
| **Fast & optimistic** | Data is cached in-memory (TanStack Query) and revalidated in the background. Edits like re-categorizing a transaction apply immediately and roll back automatically on failure. Installable PWA. |

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
│   ├── (auth)/          # Authenticated pages: dashboard, transactions,
│   │                    # reports, upload, settings, year-overview
│   ├── login/           # Sign-in screen
│   └── api/auth/        # NextAuth route handler
├── components/          # UI, charts, layout, budget widgets, onboarding
├── contexts/            # AppDataContext — central state and mutations
├── hooks/               # useDrive, useTransactions, useSettings, useBudget …
├── lib/
│   ├── finance.ts       # Single source of truth for period spend and refund netting
│   ├── reports.ts       # Analytics, subscription detection
│   ├── insights.ts      # Plain-language insight generation
│   ├── parser/          # CSV / XLSX parsing and date handling
│   ├── spreadsheet.ts   # XLSX → CSV conversion
│   └── google/          # Drive API wrappers and folder helpers
└── types/               # Shared TypeScript types
```

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

- **No server-side storage.** Data never leaves your Google Drive. Monera has no backend database or analytics pipeline.
- **No browser storage of financial data.** Transaction data is kept only in memory during the session — nothing is written to localStorage or IndexedDB.
- **Minimal OAuth scope.** `drive.file` grants access only to the files Monera creates — it cannot read the rest of your Drive.
- **Persistent sessions.** Google OAuth is configured to always issue a refresh token, so the app silently renews the 1-hour access token in the background — users stay signed in without being interrupted.
- **HttpOnly session cookies.** Access tokens are stored in a server-side httpOnly cookie and are never exposed to JavaScript or logged.
- **Zero third-party data sharing.** Authentication is handled entirely by Google. No personal data is sent to any third party.

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

The test suite covers the financial logic that matters most: refund netting and dashboard/reports consistency, payday-aware period math, CSV/XLSX parsing, deduplication, categorization, income reconciliation, subscription detection, and the insights engine.

---

## License

Licensed under the [GNU Affero General Public License v3.0](LICENSE).
