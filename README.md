# Monera

**Private, photo-finish personal finance.** Monera turns your bank statements into a clear monthly picture of where your money goes — budgets, spending breakdowns, recurring bills, and plain-language insights — while keeping **all of your data in your own Google Drive**. There is no Monera server and no database; the app reads and writes a single private folder in *your* Drive, and never sees your financial data.

---

## Highlights

- **Your data, your Drive.** Everything is stored in a private `Monera/` folder in your own Google Drive. The app requests only the minimal `drive.file` scope — access to the files it creates, nothing else.
- **Import CSV or Excel.** Drop in a Revolut export (`.csv` or `.xlsx`); other banks are auto-detected by their column headers. Excel files are converted to CSV in the browser on upload.
- **Payday-aware budgeting.** Budget periods run from one payday to the next (e.g. the 24th), not the calendar month. Set a global default or override income and the needs/wants/savings split per period.
- **One source of truth for the numbers.** Income, expenses, savings, refunds, and category totals are computed in one place, so the Dashboard, Reports, and charts never disagree.
- **Reports & insights.** A tabbed Reports view (Overview · Merchants · Subscriptions) with budget-vs-actual, month-over-month trends, top/most-frequent merchants, automatic **subscription detection**, and a prioritized **Insights** feed ("You're €40 over your Wants budget", "Spending is 18% lower than last period").
- **Smart categorization.** Transactions are categorized by your keyword rules (case-insensitive, partial-match), with per-transaction overrides that always win and are remembered.
- **Recurring payments & manual entries.** Track fixed bills paid outside your card, and add manual income or expenses by hand.
- **Duplicate-safe imports.** Re-uploading the same statement never creates duplicates, and two genuinely identical same-day purchases are both preserved.
- **Guided first run.** New users get a short onboarding flow: connect Drive → upload a statement → set payday → done.
- **Installable PWA** with offline-friendly caching and a mobile-first, responsive UI.

---

## Tech stack

| Area | Choice |
|------|--------|
| Framework | [Next.js 16](https://nextjs.org) (App Router) + React 19 |
| Auth | [NextAuth v5](https://authjs.dev) — Google OAuth (JWT sessions) |
| Storage | Google Drive REST API (`drive.file` scope) |
| Styling | Tailwind CSS v4, shadcn/ui (Radix), Framer Motion |
| Charts | Recharts |
| Spreadsheets | SheetJS (lazy-loaded for `.xlsx`) |
| Testing | Vitest |

There is no backend service or database — the Next.js app talks directly to the Google Drive API on the user's behalf, and each user's data lives only in their own Drive.

---

## Getting started

### Prerequisites
- Node.js 20+
- A Google Cloud project with an OAuth 2.0 Client (Web application)

### 1. Configure Google OAuth
In the [Google Cloud Console](https://console.cloud.google.com/):
1. Enable the **Google Drive API**.
2. Configure the **OAuth consent screen** (set the app name to *Monera* and add a logo — this is what users see on the consent dialog). While in testing, add yourself and any testers as **Test users**.
3. Create an **OAuth Client ID** (Web application) and add the redirect URI:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://your-domain/api/auth/callback/google` (production)

### 2. Environment variables
Create `.env.local`:

```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
NEXTAUTH_SECRET=run `openssl rand -base64 32`
NEXTAUTH_URL=http://localhost:3000
```

### 3. Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with Google.

> The `xlsx` dependency is installed from SheetJS's official CDN (the patched build), so the first `npm install` needs network access to `cdn.sheetjs.com`.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | Lint with ESLint |
| `npm test` | Run the test suite (Vitest) |

---

## Project structure

```
src/
├── app/
│   ├── (auth)/            # Authenticated app: dashboard, transactions, reports,
│   │                      # upload, settings, year-overview
│   ├── login/             # Sign-in screen
│   └── api/auth/          # NextAuth route handler
├── components/            # UI, charts, layout, budget, onboarding
├── contexts/              # AppDataContext — central state hub
├── hooks/                 # useDrive, useTransactions, useSettings, useBudget, …
├── lib/
│   ├── parser/            # Revolut + generic CSV parsing, date handling
│   ├── finance.ts         # Single source of truth for period spend / refunds
│   ├── reports.ts         # Analytics, subscription detection
│   ├── insights.ts        # Plain-language insight generation
│   ├── spreadsheet.ts     # XLSX → CSV conversion
│   └── google/            # Drive API + folder/file helpers
└── types/                 # Shared TypeScript types
```

### How your data is stored

```
Monera/
├── revolut-exports/       # Your uploaded statements (CSV)
└── app-data/              # settings, category rules, overrides,
                           # manual transactions, exclusions, parse cache (JSON)
```

---

## Privacy & security

- Data never leaves your Google Drive; Monera has no server-side storage.
- Minimal OAuth scope (`drive.file`) — the app can only touch the files it creates.
- Access tokens are kept in an httpOnly session cookie and are never persisted to the browser or logged.
- Account access is controlled entirely by Google (OAuth test users during testing; anyone with a Google account once the app is published).

---

## Deployment

Deploys cleanly to [Vercel](https://vercel.com). Set the four environment variables above in the project settings, and add your production callback URL to the Google OAuth client. The app builds with `next build` and runs as a standard Next.js app.

---

## Testing

```bash
npm test
```

The suite covers the financial logic that matters most: refund-netting and dashboard/reports consistency, payday-aware period math, CSV/XLSX parsing, duplicate handling, categorization, income reconciliation, subscription detection, and the insights engine.
