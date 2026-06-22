# Monera — Marketing Implementation Backlog

*Last updated: 2026-06-22 · Executes §2 of `marketing-review.md` · Domain: `https://mymonera.com`*

> Ready-to-execute tickets with the **actual copy already written**. Order is by leverage-per-hour.
> Each ticket has: effort, the change, the content, and acceptance criteria. AGENTS.md reminder: Next 16
> differs from training data — check `node_modules/next/dist/docs/` before writing
> `sitemap`/`robots`/metadata APIs.
>
> **✅ STATUS (implemented 2026-06-22, branch `marketing-seo-landing`):** Tickets 1–6 are all built and
> verified (typecheck + `next build` + 105 tests pass; routes, meta tags, canonical, JSON-LD, robots,
> sitemap, and OG image confirmed at runtime). The OG image is generated programmatically via
> `src/app/opengraph-image.tsx` (no static PNG needed). Remaining manual follow-ups: drop a real
> dashboard screenshot into the product-preview placeholder in `page.tsx`; set `NEXTAUTH_URL` and submit
> the sitemap in Search Console after deploy.

---

## TICKET 1 — OG share image + Open Graph/Twitter metadata (M, do first)

**Why first:** Every acquisition channel (HN, Reddit, WhatsApp, X) is share-driven. Today a shared
`mymonera.com` link renders as a bare grey box. One image + one metadata block fixes click-through everywhere.

**1a. OG image** — `public/og.png`, 1200×630. Brief:
- Background `#1E3A5F` (existing theme color). Serif "Monera" wordmark (matches the DM Serif brand mark).
- Headline: **"Finally know where your money goes."**
- Subline: **"Private budgeting for Revolut — stored in your own Google Drive."**
- Small footer row of pills: `Free` · `Open-source` · `No bank login`.
- (Can be generated with the `image` skill, or a Next `opengraph-image.tsx` route for auto-generation.)

**1b. Metadata** — in [src/app/layout.tsx](src/app/layout.tsx), extend root `metadata`:
- `metadataBase: new URL("https://mymonera.com")`
- `openGraph`: `{ type: "website", url: "https://mymonera.com", title, description, siteName: "Monera", images: [{ url: "/og.png", width: 1200, height: 630 }] }`
- `twitter`: `{ card: "summary_large_image", title, description, images: ["/og.png"] }`

**Acceptance:** Paste `https://mymonera.com` into the [opengraph.xyz](https://www.opengraph.xyz) debugger
(or Slack/WhatsApp) → large image card with correct title/description renders.

---

## TICKET 2 — Metadata rewrite + canonical + noindex on app pages (S)

File: [src/app/layout.tsx](src/app/layout.tsx). Replace the generic root `metadata`:

- **Title (default):** `Monera — Private Budgeting for Revolut Users` *(44 chars)*
- **Title template** for sub-pages: `%s · Monera`
- **Description:** `Turn your Revolut export into payday-aware budgets and spending insights — stored privately in your own Google Drive. Free, open-source, no bank login.` *(~150 chars)*
- `alternates: { canonical: "/" }`

Per-page titles (each file's own `metadata.title`):
- `/login` → `Sign in` · `/privacy` → `Privacy Policy` · `/terms` → `Terms of Service`
- **Authed app pages** (`(auth)/layout.tsx` or each page): `robots: { index: false, follow: false }` so
  `/dashboard`, `/transactions`, `/insights`, etc. never appear in search.

**Acceptance:** View source on `/` shows the new title/description; `/dashboard` source shows
`<meta name="robots" content="noindex">`.

---

## TICKET 3 — sitemap.ts + robots.ts (S)

- `src/app/sitemap.ts` → returns the four public routes (`/`, `/login`, `/privacy`, `/terms`) with
  `https://mymonera.com` base. (Authed routes excluded.)
- `src/app/robots.ts` → `allow: "/"`, `disallow: ["/dashboard", "/transactions", "/insights", "/upload", "/settings", "/year-overview"]`, `sitemap: "https://mymonera.com/sitemap.xml"`.

**Acceptance:** `https://mymonera.com/sitemap.xml` and `/robots.txt` resolve; submit sitemap in the
already-verified Search Console property.

---

## TICKET 4 — Structured data / JSON-LD (S)

On the landing page ([src/app/page.tsx](src/app/page.tsx)), add two `<script type="application/ld+json">` blocks:

- **SoftwareApplication:** name "Monera", `applicationCategory: "FinanceApplication"`,
  `operatingSystem: "Web"`, `offers: { price: "0", priceCurrency: "USD" }`, url, description.
- **FAQPage:** the five Q&As from Ticket 5's FAQ section (keep on-page text and JSON-LD identical).

**Acceptance:** Passes Google's [Rich Results Test](https://search.google.com/test/rich-results) for both types.

---

## TICKET 5 — Landing-page expansion (L) — copy deck below is ready to drop in

File: [src/app/page.tsx](src/app/page.tsx). Keep the calm aesthetic, serif headings, `#1E3A5F`. Add the
sections in this order. **All copy below is final-draft — implement as layout, not writing.**

### Hero (keep, lightly extend)
> # Finally know where your money goes.
> Import your Revolut statement and get a clear breakdown of your spending — budgets, categories, and
> insights, all in one place. Your data stays in **your own Google Drive**. We never see it.
>
> **[ Get started — it's free ]**
> Free · Open-source · No bank login

### Trust strip (new, thin band under hero)
> **No backend. No database. No bank login.** Your finances live in a private folder in your Google
> Drive — Monera only ever sees the files it creates. [View the source on GitHub →]

### How it works (new — 3 steps, one screenshot each)
> **1. Export from Revolut** — Download a CSV or Excel statement from the Revolut app. *(screenshot: Revolut export)*
> **2. Import to Monera** — Drop the file in. Nothing leaves your machine until it's saved to your Drive. *(screenshot: upload screen)*
> **3. See where it went** — Payday-aware budgets, categories, subscriptions, and plain-English insights. *(screenshot: dashboard)*

### Privacy / open-source band (new — give it real estate)
> ## Your money is nobody's business but yours.
> Most budgeting apps ask you to link your bank and trust them with everything. Monera doesn't. There's
> no Monera server and no database — your data is written only to a private `Monera/` folder in your own
> Google Drive, using the minimal `drive.file` permission that can't even see the rest of your Drive.
> It's open-source under AGPL, so you don't have to take our word for it. [Read the code →]

### Comparison table (new — fair and factual)
| | **Monera** | Revolut's analytics | YNAB / Monarch |
|---|---|---|---|
| Payday-to-payday budgets | ✅ | ❌ calendar month | ❌ calendar / manual |
| Where your data lives | **Your Google Drive** | Revolut's servers | Their servers |
| Bank login required | ❌ no | n/a (it's your bank) | ✅ yes |
| Price | **Free** | Free | Paid subscription |
| Open-source | ✅ | ❌ | ❌ |

### FAQ (new — mirror these exactly in Ticket 4 JSON-LD)
> **Is my data really private?** Yes. There's no Monera server or database. Your data is written only to
> your own Google Drive via the `drive.file` scope, which can't see the rest of your Drive. It's
> open-source, so you can verify it.
>
> **Does it only work with Revolut?** Today, yes — and that focus is why the import and budgets fit
> Revolut life so well. More banks are on the roadmap.
>
> **Is it free?** Yes, free and open-source. There's no account on our side and nothing to upsell.
>
> **Why does it need Google Drive access?** That's where your private folder lives — granting access is
> how your data gets saved to *your* account. Monera only ever sees files it created.
>
> **Is it open-source?** Yes, under AGPL v3. [View the repository →]

### Close CTA (new)
> ## Know where your money goes — without giving it away.
> **[ Get started — it's free ]**
> No bank login. No subscription. Your data stays in your Drive.

**Acceptance:** All eight sections render; "Revolut" and "open-source/free" appear above the fold;
GitHub link present; comparison + FAQ live; mobile layout holds.

---

## TICKET 6 — Consistency sweep (S)
- [public/manifest.json](public/manifest.json) `description`: change "Personal finance tracker" →
  `Private budgeting for Revolut — stored in your own Google Drive.`
- Confirm README hero, landing hero, and metadata description tell one consistent story.

**Acceptance:** The three surfaces use the same core sentence.

---

## Suggested execution order
1. Ticket 1 (OG image + tags) — unblocks every share channel.
2. Ticket 2 (metadata) — bundle with 1, same file.
3. Ticket 6 (consistency) — trivial, do alongside.
4. Ticket 5 (landing page) — the big conversion lift; copy is already written above.
5. Tickets 3 + 4 (sitemap/robots/JSON-LD) — technical SEO, do after the page is final so schema matches.

Then move to `marketing-review.md` §3 (launch push) once the site converts and shares well.
