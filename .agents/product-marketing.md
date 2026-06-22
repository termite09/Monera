# Product Marketing Context

*Last updated: 2026-06-22*

> This is the single source of truth for Monera's positioning and messaging. Other marketing
> work (copy, ads, SEO, landing pages, launch) should reference it so messaging stays consistent.
> Sections marked _(confirm)_ are inferred from the codebase/README and should be validated by the
> founder.

## Product Overview
**One-liner:** Private budgeting for Revolut users — your money, your Google Drive, no one else's server.

**What it does:** Monera turns a Revolut CSV/Excel export into a clear, payday-aware picture of where
your money goes — budgets, category breakdowns, merchant analytics, subscription detection, and
plain-language insights. Every byte is stored in a private folder in the user's *own* Google Drive.
There is no Monera backend, no database, and no financial data on any third-party server.

**Product category:** Personal finance / budgeting app — specifically the "private, bring-your-own-data
budgeting" and "Revolut spending tracker" shelves.

**Product type:** Free, open-source (AGPL v3) web app + installable PWA. Client-side only; storage is
the user's Google Drive via the minimal `drive.file` OAuth scope.

**Business model:** Free today (no revenue). Intent: stay free/open-source to grow adoption, then
monetize later via a hosted/managed "just sign in" version and an optional premium tier. See
`marketing-review.md` §4.

## Target Audience
**Target users _(confirm)_:** Revolut-primary spenders in the UK/EU who are paid on a fixed payday,
are comfortable enough to export a statement, and care about not handing their transaction history to
yet another fintech. Skews privacy-aware, tech-literate, and frustrated that bank apps show
transactions but not understanding.

**Decision-maker:** B2C — the user is the buyer. No procurement, no stakeholders.

**Primary use case:** "At the end of a pay period, show me where my money actually went and whether I
stayed inside my budget — without giving a company access to my bank."

**Jobs to be done:**
- Understand my spending this pay period (not this calendar month) and stay inside a budget that
  matches when I actually get paid.
- See my real recurring costs — subscriptions and bills — and catch the ones I forgot about.
- Get the clarity of a budgeting app without linking my bank or trusting a third party with my data.

**Use cases / scenarios:**
- Monthly "where did it go" review after payday.
- Hunting down silent subscriptions and creeping recurring bills.
- Checking "safe to spend" before payday.
- Year-in-review of spending by payday period.

## Personas
B2C single-persona product — formal multi-stakeholder personas don't apply. Core persona:

| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| The privacy-minded Revolut spender _(confirm)_ | Knowing where money goes; not leaking financial data | Bank app shows transactions, not insight; budgeting apps want bank login + a subscription | Real insight from a file you already have, stored only in your own Drive |

## Problems & Pain Points
**Core problem:** People can see every transaction in their bank app but still have no idea where their
money actually goes — and the tools that would tell them require linking a bank, paying a subscription,
and trusting a company with the most sensitive data they have.

**Why alternatives fall short:**
- Revolut's built-in analytics are shallow, calendar-month based, and don't model a payday cycle.
- YNAB / Monarch / Copilot require bank-credential linking, charge a subscription, and skew US-centric.
- Spreadsheets are private but entirely manual and quickly abandoned.

**What it costs them:** Money lost to forgotten subscriptions and untracked drift; the recurring stress
of not knowing if they can spend before payday; the privacy cost of linking a bank to a third party.

**Emotional tension:** A low-grade anxiety and guilt about money combined with distrust of giving a
fintech full access. "I want to get my act together, but not by handing my whole financial life to
another app."

## Competitive Landscape
**Direct:** Revolut's own in-app analytics — same data, same user, but shallow, calendar-month, no
payday logic, no cross-cutting insights, no export-based deep analysis.

**Secondary:** YNAB, Monarch Money, Copilot — full-featured budgeting, but paid, require bank-credential
linking, store your data on their servers, and are weaker for Revolut/EU users.

**Indirect:** Spreadsheets and "I'll just check my bank app" — private and free, but manual, tedious,
and abandoned within weeks.

## Differentiation
**Key differentiators:**
- **Your data never touches our server** — it lives in a private folder in your own Google Drive.
- **Minimal `drive.file` scope** — the app can only see files it created, not the rest of your Drive.
- **Payday-to-payday budgets** — periods match real life, not the calendar.
- **Revolut-native import** — CSV/Excel, dated by when you tapped the card; duplicate-safe re-imports.
- **Free and open-source (AGPL)** — auditable; no lock-in; no subscription.
- **Installable PWA** with optimistic, fast UX.

**How we do it differently:** No backend and no database at all. Auth + storage are handled entirely by
Google; Monera is effectively a client that reads/writes your own Drive folder.

**Why that's better:** You get budgeting-app insight with spreadsheet-level privacy — and you never link
a bank or pay a subscription.

**Why customers choose us _(confirm)_:** They're Revolut users who want real insight but refuse to link
their bank or pay another fintech, and the "stored in my own Drive, open-source, free" combination is
uniquely reassuring.

## Objections
| Objection | Response |
|-----------|----------|
| "Does it only work with Revolut?" | Today, yes — and that focus is why the import and budgets fit Revolut life so well. More banks are on the roadmap. |
| "Is my data really private?" | There's no Monera server or database. Your data is written only to your own Google Drive via the `drive.file` scope, which can't even see the rest of your Drive. It's open-source, so you can verify it. |
| "Why Google Drive / why grant Drive access?" | Drive is where your private folder lives — granting access is how your data gets saved to *your* account. Monera only ever sees files it created. |
| "Is it free? What's the catch?" | It's free and open-source. No account on our side, nothing to upsell today. |

**Anti-persona:** Non-Revolut users; multi-bank power users who need many connected accounts and
real-time sync; people who want a fully hands-off auto-linked app and don't want to export a file.

## Switching Dynamics
**Push:** Frustration that the bank app shows transactions but no understanding; surprise subscription
charges; calendar-month budgets that never match payday.

**Pull:** Real insight from a file they already have; data that stays in their own Drive; free and
open-source; budgets that finally match their pay cycle.

**Habit:** "I'll just glance at my bank app" / an abandoned spreadsheet — low effort, low payoff, but
familiar.

**Anxiety:** "Is exporting and uploading a statement a hassle?" "Do I trust granting Drive access?"
"Will it actually be more useful than my bank app?"

## Customer Language
_(Populate with verbatim quotes from real users — Reddit r/Revolut, reviews, support, interviews.
Placeholders below to be replaced.)_

**How they describe the problem:**
- "I have no idea where my money goes each month." _(confirm with real quotes)_
- "I don't want to link my bank to another app." _(confirm)_

**How they describe us:** _(collect post-launch)_

**Words to use:** private, your own Google Drive, payday, no server, no bank login, open-source, free,
Revolut export, where your money goes, safe to spend.

**Words to avoid:** "we store," "upload to our platform," "sync your bank," "enterprise," jargon like
"FP&A"; anything implying Monera holds the data.

**Glossary:**
| Term | Meaning |
|------|---------|
| Period / pay period | A payday-to-payday window (e.g. the 24th to the 24th), not a calendar month |
| `drive.file` scope | Minimal Google permission — app only sees files it created |
| Safe to spend | Forward-looking amount left before payday after spend, savings, and recurring bills |
| Recurring bills | Fixed costs paid outside Revolut, tracked as synthetic transactions |

## Brand Voice
**Tone:** Calm, precise, trustworthy. Privacy-confident without being preachy.

**Style:** Plain-English and concrete; explains the number behind every figure; never hypey.

**Personality:** Honest, private, meticulous, quietly clever, respectful of the user's intelligence.

## Proof Points
**Metrics _(to collect)_:** activation rate (sign-in → first successful import), users, GitHub stars.

**Customers/logos:** none yet (pre-traction).

**Testimonials:** none yet — prioritize collecting 3–5 post-launch.

**Value themes:**
| Theme | Proof |
|-------|-------|
| Truly private | No backend/DB; `drive.file` scope; in-memory only, no localStorage of financial data; open-source |
| Fits real life | Payday-to-payday periods; override income/splits per period |
| Revolut-native | CSV/XLSX import, card-tap dating, duplicate-safe re-imports |
| Real insight | Subscription detection, merchant analytics, month-over-month, safe-to-spend, plain-language insights |

## Goals
**Business goal (now):** Grow adoption among Revolut/privacy-minded users while free; build reputation
and an audience to monetize later.

**Key conversion action:** Sign in with Google → complete a first successful statement import
(= activation). Secondary: install the PWA; GitHub star.

**Current metrics:** Unknown/early. Vercel Analytics is wired for anonymous usage; define the
activation funnel and baseline it (see `marketing-review.md` §5).
