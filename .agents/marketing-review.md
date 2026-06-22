# Monera — Web & Marketing Review

*Last updated: 2026-06-22 · Companion to `product-marketing.md`*

> **Scope:** This is a review + roadmap. Nothing here has been implemented — every on-site item in §2
> is a recommendation. Effort tags: **S** ≈ <1h, **M** ≈ half-day, **L** ≈ a day+.
>
> **Production domain:** `https://mymonera.com` (used for all canonical/OG/sitemap references below).
> Note: still `localhost` in `.env.local` — set `NEXTAUTH_URL=https://mymonera.com` in the production
> environment, and confirm `https://mymonera.com/api/auth/callback/google` is registered on the Google
> OAuth client.

---

## 1. Executive summary

Monera's product is genuinely differentiated — *private, your-own-Drive, payday-aware, Revolut-native,
free, open-source*. The website barely says any of it. The landing page is a single hero plus three
cards; the SEO metadata is generic and inconsistent; there are no social share cards; and there's no
acquisition motion. The good news: the gap between product and presentation is the opportunity. Most
wins here are copy and metadata, not engineering.

**Strongest assets:** a sharp niche (Revolut users), an unusually trustworthy privacy story, a clean
calm aesthetic, a solid README, and Search Console already verified + Vercel Analytics already wired.

**What's costing reach right now:**
1. Generic, inconsistent metadata — [layout.tsx:33](src/app/layout.tsx#L33) says "Track your finances
   effortlessly" while [page.tsx:5-8](src/app/page.tsx#L5-L8) says something much better. Neither
   targets the keywords people actually search.
2. No Open Graph / Twitter cards or OG image — every shared link (Reddit, HN, WhatsApp, X) renders
   bare, killing click-through on exactly the channels this product should grow on.
3. The two best hooks — *Revolut-native* and *open-source + your-own-Drive* — are nearly invisible on
   the landing page. "Revolut" appears once; "open source / free" not at all.
4. No "how it works," no screenshots, no FAQ, no comparison — so a curious visitor can't quickly
   answer "is this legit, is it private, is it for me?"
5. No acquisition plan — no content, no community motion, no launch.

**Top 5 moves (in order):**
1. Rewrite metadata + add OpenGraph/Twitter config and a single OG image (§2.1–2.2). **S/M, high impact.**
2. Expand the landing page: screenshots, 3-step "how it works," privacy/open-source band, comparison
   mini-table, FAQ, stronger close CTA (§2.5). **L, high impact.**
3. Add `sitemap.ts`, `robots.ts`, and `SoftwareApplication` + `FAQPage` JSON-LD (§2.3–2.4). **S, medium.**
4. Ship a focused acquisition push: Show HN + r/Revolut + Product Hunt + directories (§3). **M, high.**
5. Stand up the activation funnel in analytics and baseline it (§5). **S, enables everything.**

---

## 2. On-site fixes (prioritized)

### 2.1 Metadata rewrite — **S, high impact**
File: [layout.tsx](src/app/layout.tsx).
- Make the root `metadata` the real marketing copy, and add `metadataBase: new URL("https://mymonera.com")`
  so OG/canonical URLs resolve.
- Title targeting intent, e.g. `"Monera — Private Budgeting for Revolut, in Your Own Google Drive"`
  (keep it under ~60 chars; trim if needed).
- Description aligned with [page.tsx](src/app/page.tsx), e.g. *"Turn your Revolut export into payday-aware
  budgets and spending insights — stored privately in your own Google Drive. Free, open-source, no
  bank login."*
- Add `alternates: { canonical: "/" }`.
- Per-page metadata: give `/login`, `/privacy`, `/terms` their own titles; the app pages behind auth
  should be `robots: { index: false }`.

### 2.2 Open Graph + Twitter cards + OG image — **M, high impact**
- Add `openGraph` (type `website`, title, description, url, one 1200×630 image) and
  `twitter` (`summary_large_image`) blocks to root `metadata`.
- Create one OG image — a clean brand+tagline card ("Finally know where your money goes — privately").
  Either a static `public/og.png` or a Next `opengraph-image` route. Reuse the existing serif brand mark
  and `#1E3A5F` theme color for consistency.
- This single asset is the highest leverage item for the share-driven channels in §3.

### 2.3 sitemap.ts + robots.ts — **S, medium impact**
- Add `src/app/sitemap.ts` listing the public routes (`/`, `/login`, `/privacy`, `/terms`).
- Add `src/app/robots.ts` allowing crawl of public routes, disallowing the authed app paths, and
  pointing to the sitemap. (Next 16 App Router supports both as convention files — check
  `node_modules/next/dist/docs/` for the current API before writing.)

### 2.4 Structured data (JSON-LD) — **S, medium impact**
- Add `SoftwareApplication` JSON-LD on the landing page (name, category `FinanceApplication`,
  `offers` price `0`, operatingSystem "Web").
- Add `FAQPage` JSON-LD matching the on-page FAQ from §2.5 (eligible for rich results).

### 2.5 Landing-page expansion — **L, high impact**
File: [page.tsx](src/app/page.tsx). Keep the calm aesthetic; add depth and the missing hooks. Suggested
section order:
1. **Hero** — keep "Finally know where your money goes." Add a one-line privacy subhead and surface
   the badges the product has earned: *Free · Open-source · Your data stays in your Drive*.
2. **Social/trust strip** — "No backend. No database. No bank login." + a GitHub link/star.
3. **How it works (3 steps)** — Export your Revolut statement → Import the file → See payday-aware
   budgets & insights. One screenshot per step.
4. **Product screenshots** — dashboard donuts, insights, subscription detection. Currently zero
   product imagery; this is the biggest credibility gap.
5. **Privacy / open-source band** — explain `drive.file`, "we never see it," AGPL + link to repo.
   This is the differentiator; give it real estate.
6. **Comparison mini-table** — Monera vs Revolut's built-in analytics vs YNAB/Monarch, on the axes that
   matter: payday budgets, data location, bank-link required, price, open-source. (Keep it fair and factual.)
7. **FAQ** — "Is my data really private?", "Does it only work with Revolut?", "Is it free?", "Why does it
   need Google Drive access?", "Is it open-source?" (Mirror in `FAQPage` JSON-LD from §2.4.)
8. **Close CTA** — repeat "Get started — it's free" with the privacy reassurance underneath.

Copy guardrails: lead with the niche (Revolut) and privacy; never soften to generic "track your
finances." Use the words-to-use / words-to-avoid list in `product-marketing.md`.

### 2.6 Small consistency fixes — **S, low effort**
- `public/manifest.json` description is "Personal finance tracker" — align it with the new positioning.
- Ensure the README hero line, landing hero, and metadata description tell one consistent story.

---

## 3. Acquisition channels (free-now, grow stage)

Ranked for *this* product. The niche (Revolut + privacy + open-source + free) is the moat — lean into
it rather than competing broadly with YNAB.

1. **Show HN / Hacker News — high fit.** Local-first, no-backend, open-source, privacy-respecting,
   `drive.file`-only — this is a textbook HN story. Lead with the architecture and privacy model, not
   the budgeting. Requires the OG image and a screenshot-rich landing page first (§2).
2. **Reddit communities — high fit.** r/Revolut (most targeted), r/personalfinanceEU, r/privacy,
   r/selfhosted-adjacent / local-first crowds. Be a participant, not a billboard; lead with the
   problem and the privacy angle. Don't spam — one good post per community.
3. **Product Hunt + BetaList — medium/high.** Good for a launch spike, backlinks, and early reviews.
   Time it after the landing-page work lands. (See the `launch` skill when ready.)
4. **Directories for backlinks/discovery — medium.** Open-source (GitHub topics, Awesome-* lists),
   indie/SaaS, AI/privacy, and "alternatives" sites (AlternativeTo as a *YNAB/Revolut alternative*).
   Steady DR + referral trickle. (See `directory-submissions`.)
5. **SEO content — medium, compounding.** Target Revolut + private-budgeting long-tail:
   "how to see where your money goes on Revolut," "export Revolut statement to a budget,"
   "private budgeting app without bank login," "YNAB alternative that doesn't link your bank,"
   "payday budgeting." Pairs with comparison/alternative pages (see `competitors`, `content-strategy`).
6. **GitHub as a channel — low effort, ongoing.** The README is strong; add screenshots, a hosted-demo
   link at the top, and rich repo topics/keywords. Stars are social proof you can cite on the site.

Sequencing: do §2.1–2.5 first (the site has to convert and share well), then a coordinated push of
HN + Reddit + Product Hunt + directories in one window, then sustain with SEO/comparison content.

---

## 4. Future monetization (sketch — not a commitment)

Stay free/open-source now to grow; keep these paths open:

- **Hosted / managed "just sign in" version — most promising.** The biggest friction today is the
  self-host setup (Google Cloud project, OAuth client, env vars — see README "Getting Started"). A
  hosted instance where a non-technical user just clicks "Sign in with Google" is a clear, honest thing
  to charge for: convenience, not the software. **AGPL note:** running a modified hosted version means
  you must offer that version's source — keep the hosted build's source available, or keep it unmodified.
- **Optional premium tier** on the hosted version: more banks/import formats beyond Revolut, multiple
  accounts, longer history, advanced insights/exports, scheduled email summaries. Gate *extras*, never
  the core privacy promise.
- **Pay-what-you-want / GitHub Sponsors** now — a near-zero-effort way to read early willingness to pay
  and fund the work, without building billing.
- **What NOT to do:** don't introduce a backend that stores financial data, and don't paywall the
  privacy story — both would destroy the core differentiator.

Rough sequence when ready: validate demand (sponsors + a waitlist for a hosted version) → build the
hosted "just sign in" path → add a paid tier for multi-bank/advanced features. See `pricing` and
`offers` skills when you reach that point.

---

## 5. Measurement

Vercel Analytics is already wired ([layout.tsx](src/app/layout.tsx) `<Analytics />`). Define and
baseline the funnel:

- **North-star activation:** sign-in → **first successful statement import**. This is the moment of
  value; it's the number to move.
- **Funnel to watch:** landing visit → click "Get started" → reach `/login` → Google consent →
  first import complete → returns for a 2nd period.
- **Secondary signals:** PWA installs, GitHub stars, referral sources (to learn which §3 channel works).
- **For the landing-page rebuild:** treat it as a before/after on landing→login click-through; when you
  later want to test variants, use the `ab-testing` skill.

---

## Appendix — file references used in this review
- [src/app/layout.tsx](src/app/layout.tsx) — root metadata, Analytics, fonts/theme.
- [src/app/page.tsx](src/app/page.tsx) — landing page (hero, 3 feature cards, CTA, footer).
- [src/app/login/LoginCard.tsx](src/app/login/LoginCard.tsx) — sign-in copy (privacy messaging is good here).
- [public/manifest.json](public/manifest.json) — PWA metadata (description needs aligning).
- [README.md](README.md) — strong; the source for most positioning claims above.
- `public/googled381c97149c95555.html` — Search Console verification (already set up).
