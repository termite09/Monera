---
name: Monera
description: Private budgeting for Revolut users — your money, your Google Drive, no one else's server.
colors:
  anchor-navy: "#1C3557"
  anchor-navy-light: "#4A7EC7"
  off-white: "#F8F7F4"
  near-black: "#0C0C0B"
  card-white: "#FFFFFF"
  warm-surface: "#F1EFE9"
  border-warm: "#E4E2DC"
  muted-gray: "#6B7280"
  destructive-red: "#DC2626"
typography:
  display:
    fontFamily: "DM Serif Display, Georgia, serif"
    fontSize: "3rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "DM Serif Display, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "DM Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "DM Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.anchor-navy}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "#162a47"
    textColor: "{colors.card-white}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.near-black}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.near-black}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  card-default:
    backgroundColor: "{colors.card-white}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
  input-default:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.near-black}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  badge-primary:
    backgroundColor: "{colors.anchor-navy}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  badge-secondary:
    backgroundColor: "{colors.warm-surface}"
    textColor: "{colors.near-black}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: Monera

## 1. Overview

**Creative North Star: "The Private Ledger"**

Every screen in Monera should feel like a well-kept private notebook — precise entries, deliberate whitespace, nothing decorative that doesn't earn its place. The interface serves the user's financial record, not the other way around. Data is the protagonist; chrome and ornamentation are the supporting cast.

The design walks a careful line: warm enough to feel like a personal tool (not an enterprise dashboard), calibrated enough to earn trust with money (not a lifestyle app). Confidence is expressed through restraint — Anchor Navy appears only where it counts: calls to action, active navigation states, focus rings, and progress fills. Everywhere else, the palette recedes and lets numbers speak.

This system explicitly rejects the utilitarian, spreadsheet-y aesthetic of traditional budgeting tools — the kind where the design communicates "tool" before "product." It also rejects badge-heavy privacy marketing: security claims expressed as shield icons on every surface read as anxiety, not assurance. Privacy here is architectural; the copy explains the mechanism once, and the interface simply executes it, cleanly and without fanfare.

**Key Characteristics:**
- Flat surfaces; tonal depth through surface stacking, not shadows
- One primary color (Anchor Navy) on ≤10% of any given screen
- DM Serif Display reserved for brand moments; DM Sans carries the product
- DM Mono for every financial figure without exception
- Card White on Off-White: the tonal separation does the work of shadows
- All borders and surfaces stay in one warm tonal family

## 2. Colors: The Anchor Palette

A single saturated navy anchors an otherwise warm-neutral field. One primary, seven neutrals, three semantic statuses. The palette's restraint is the point.

### Primary
- **Anchor Navy** (`#1C3557`): The single saturated color in the system. Used on primary CTAs, active navigation, progress fill, and focus rings. Its scarcity is intentional — every appearance is load-bearing. Dark mode variant: **Steel Blue** (`#4A7EC7`), a lighter reading that preserves the hue on dark backgrounds.

### Neutral
- **Near-Black** (`#0C0C0B`): Default body and card text. Near-black rather than pure black — softer against warm backgrounds without sacrificing contrast (passes 4.5:1 on Off-White and Card White).
- **Off-White** (`#F8F7F4`): Page background. The ground on which everything else sits. Slightly warm — but warmth is incidental, not thematic. Surfaces above it (Card White) are cooler and brighter, creating tonal separation without shadow.
- **Card White** (`#FFFFFF`): Elevated surfaces — cards, popovers, sidebar, bottom navigation bar. Pure white against Off-White creates clear visual layering at zero elevation cost.
- **Warm Surface** (`#F1EFE9`): Secondary/muted surface. Hover states, input track fills, progress track, secondary button backgrounds. The middle rung of the tonal stack.
- **Border Warm** (`#E4E2DC`): Card edges, input strokes, dividers. Warm-tinted so separators don't read as cold or clinical.
- **Muted Gray** (`#6B7280`): Secondary text, placeholder text, inactive navigation labels, supporting metadata. Passes 4.5:1 contrast against both Card White and Off-White.
- **Destructive Red** (`#DC2626`): Error states, over-budget indicators, destructive action buttons. Semantic-only — never used decoratively.

### Named Rules
**The One Anchor Rule.** Anchor Navy is the only saturated color used on neutral UI. Budget status colors (emerald OK / amber warning / destructive over) are semantic signals, not accent colors. If a new component wants "more color," the answer is Anchor Navy — there is no secondary accent.

**The Tonal Stack Rule.** Surfaces are layered in one direction: Off-White (page) → Card White (surface) → Warm Surface (hover/muted/track). Never invert this order. Never place a Warm Surface card on a Card White background — the contrast is imperceptible and breaks the stack's logic.

## 3. Typography: The DM Triad

**Display/Brand Font:** DM Serif Display (serif, 400)
**Body/UI Font:** DM Sans (humanist sans-serif, 400–700)
**Numeric/Data Font:** DM Mono (monospace, 400–500)

**Character:** The DM family was designed to work together. Serif Display brings editorial warmth to brand moments and section headings on public pages; Sans carries all product UI without friction; Mono locks every financial figure into consistent tabular columns. Three related typefaces, one coherent voice. The contrast axis is right — an editorial serif paired with a humanist sans — without the families fighting each other.

### Hierarchy
- **Display** (DM Serif Display, 400, `3rem`, lh 1.1, ls -0.01em): Hero headline and landing-page CTAs only. Never used inside the product app.
- **Headline** (DM Serif Display, 400, `1.5rem`, lh 1.25, ls -0.01em): Section titles on public pages; the "Monera" wordmark in sidebar and mobile header. The brand signature at app scale.
- **Title** (DM Sans, 600, `1.125rem`, lh 1.4): Card titles and page section headers inside the app. Sans in the product — serif is reserved for brand surfaces.
- **Body** (DM Sans, 400, `1rem`, lh 1.6): Narrative paragraphs, insight copy, descriptions. Maximum 65–75ch line length.
- **Label** (DM Sans, 500, `0.875rem`, lh 1.4): Button labels, form labels, navigation items, UI controls.
- **Caption** (DM Sans, 400, `0.75rem`, lh 1.4): Supporting metadata, timestamps, badge text, helper copy.
- **Mono** (DM Mono, 400–500, `0.875rem`, lh 1.5, tabular-nums): Every financial amount, percentage, budget figure, and transaction value. Non-negotiable.

### Named Rules
**The Serif Boundary Rule.** DM Serif Display appears only in two contexts: the "Monera" wordmark (sidebar, mobile header, landing nav) and section headings on public-facing pages. Inside the product — dashboard, transactions, insights, settings — all headings use DM Sans. The serif is the brand signature, not a general heading font.

**The Mono Lock Rule.** Every financial amount, percentage, budget figure, and transaction value uses DM Mono with `font-variant-numeric: tabular-nums`. No exceptions. Mixing DM Sans and DM Mono within the same row of numeric data is prohibited — it breaks visual alignment and reads as untrustworthy.

## 4. Elevation

Monera is flat by default. Depth is communicated through tonal surface stacking (Off-White → Card White → Warm Surface) and 1px warm borders — never through `box-shadow`.

The one structural exception is the sticky app header, which uses `background: var(--background)/80%` with `backdrop-filter: blur(8px)` to signal position above the scroll. This is a system-level pattern for a single component; it is not available for general use.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. No `box-shadow` on cards, inputs, drawers, or popovers. If a component needs more visual presence, the answer is a slightly darker border stroke or a tonal background shift — not a shadow.

**The Blur Exception.** `backdrop-filter: blur` is reserved for one surface: the sticky app header. Blurred glass cards, modal backdrops with blur, or any other decorative application of this property are prohibited.

## 5. Components

Components in Monera are **clean and confident** — crisp defaults, visible hierarchy, built-in trust without trying hard.

### Buttons
- **Shape:** Gently rounded (8px, `rounded-lg`). Not pill, not square — approachable but precise.
- **Primary:** Anchor Navy (`#1C3557`) bg, Card White text, `h-10 px-4 py-2` (40px tall). Hover: 90% opacity toward `#162a47`. Used for the single highest-priority action per screen.
- **Focus:** `ring-2 ring-ring ring-offset-2` (Anchor Navy ring, 2px) — always visible, never hidden or overridden.
- **Outline:** Card White bg, Border Warm stroke, Near-Black text. Hover: Warm Surface bg. For secondary actions alongside a primary button.
- **Ghost:** No background or border at rest. Hover: Warm Surface bg. For tertiary actions and navigation icon controls.
- **Destructive:** Destructive Red (`#DC2626`) bg, white text. Reserved for irreversible actions only (sign out, delete data).
- **Disabled:** 50% opacity on any variant. `cursor-not-allowed`, `pointer-events-none`.

### Cards / Containers
- **Corner Style:** 12px radius (`rounded-xl`) — one step more generous than buttons; reads as container, not control.
- **Background:** Card White (`#FFFFFF`) on Off-White page background. The contrast provides all the depth needed.
- **Shadow Strategy:** None. Border only: `1px solid var(--border)`.
- **Internal Padding:** `p-6` (24px) default. `p-4` (16px) acceptable for compact data lists only.
- **Rule:** Never nest cards inside cards. A card inside a card is always a design failure. Rethink with a list, a section, or a tonal background shift.

### Inputs / Fields
- **Style:** Card White bg, Border Warm stroke (1px), 8px radius, `h-10 px-3 py-2`.
- **Focus:** `ring-2 ring-ring ring-offset-2` (Anchor Navy). The border does not change on focus — the ring is the sole signal.
- **Placeholder:** Muted Gray (`#6B7280`). Must pass 4.5:1 against Card White.
- **Error state:** Destructive Red border + red helper text below the field.
- **Disabled:** 50% opacity, `cursor-not-allowed`.

### Navigation — Sidebar (desktop)
- **Layout:** Fixed left, 224px wide, Card White bg, 1px border-right.
- **Logo:** "Monera" in DM Serif Display `text-2xl`, "Personal Finance" in `text-xs` Muted Gray beneath.
- **Item default:** Muted Gray text, 8px radius, transparent bg. Hover: Warm Surface bg + Near-Black text.
- **Item active:** `bg-primary/8` (Anchor Navy at 8% opacity) + Anchor Navy text, label weight 500. The active bg is a whisper — sufficient to orient without dominating the sidebar.

### Navigation — Bottom Bar (mobile)
- **Layout:** Fixed bottom, full width, Card White bg, 1px border-top. Safe-area inset padding.
- **Tabs:** 5 equal-width items; icon (20px) + label (10px caption).
- **Active:** Anchor Navy icon (`strokeWidth: 2.5`) + Anchor Navy label. Inactive: Muted Gray icon (`strokeWidth: 1.5`) + Muted Gray label.

### Progress / Budget Bar
- **Track:** Warm Surface bg, 6px tall, rounded-full.
- **Fill — OK** (< 80%): Emerald 500 (`#10B981`).
- **Fill — Warning** (≥ 80%, under budget): Amber 500 (`#F59E0B`).
- **Fill — Over:** Destructive Red (`#DC2626`).
- **Amounts:** DM Mono, tabular-nums. Color matches fill state (emerald / amber / destructive).
- **Rule:** These three colors are semantic status indicators. Using emerald, amber, or destructive-red anywhere outside budget/error states is prohibited.

### Budget Donut
Signature component — circular progress for Needs / Wants / Savings categories. Each donut is tappable and drills down to the transactions that compose it. Focus ring required; cursor: pointer. The amount shown inside uses DM Mono. Each category carries its own named color class (defined per the budget configuration); the donut color is not drawn from the primary palette.

### Badges / Chips
- **Shape:** Pill (`rounded-full`), `px-2.5 py-0.5`, 12px caption font.
- **Primary:** Anchor Navy bg, Card White text — classification tags, status chips.
- **Secondary:** Warm Surface bg, Near-Black text — filters, removable selections.
- **Outline:** Transparent bg, Near-Black text, Border Warm stroke — tertiary labels.

## 6. Do's and Don'ts

### Do:
- **Do** use DM Mono with `font-variant-numeric: tabular-nums` for every financial figure — amounts, percentages, budget ratios, transaction values. No exceptions.
- **Do** place Anchor Navy on ≤10% of any screen. One primary CTA, one active nav state, one focus ring per view. Its scarcity is what gives it authority.
- **Do** follow the tonal stack: Off-White → Card White → Warm Surface. This order is the system's depth model.
- **Do** explain privacy mechanically in copy: "your own Google Drive," "drive.file scope — it can only see files it created." Mechanism builds trust; badge claims do not.
- **Do** use payday-period framing throughout the product UI: "this pay period," "since [payday date]." Never "this month" — calendar months are not how this product works.
- **Do** apply `text-wrap: balance` to h1–h3 headings to prevent awkward breaks on narrow viewports.
- **Do** include `:focus-visible` with a visible 2px Anchor Navy ring on every interactive element. Hidden focus states are an accessibility failure.
- **Do** use emerald / amber / destructive-red exclusively for budget status (OK / Warning / Over). These colors mean specific things; diluting them breaks the language.

### Don't:
- **Don't** use DM Serif Display inside the product app for anything except the "Monera" wordmark. All app headings use DM Sans. The serif is a brand mark, not a product heading.
- **Don't** add `box-shadow` to cards, inputs, drawers, or containers. Flat-by-default is a system rule.
- **Don't** apply `backdrop-filter: blur` outside the sticky app header. Glass-card patterns are prohibited.
- **Don't** use emerald, amber, or destructive-red decoratively. Their meaning is fixed: budget status signals. Breaking this semantic contract makes the UI misleading.
- **Don't** let the design look like YNAB or classic budgeting spreadsheet apps — utilitarian, US-centric, functional-but-uninviting. If the interface communicates "tool" before "product," it has failed.
- **Don't** badge-stamp privacy claims. No shield icons as decorative surface elements. Privacy is architectural; the copy states the mechanism once, and the design is simply clean.
- **Don't** use calendar-month language inside the product: "this month" is wrong. "This pay period" or "since [payday]" is correct. This is product substance, not copy polish.
- **Don't** nest a card inside a card. Ever.
- **Don't** use `background-clip: text` with a gradient. Gradient text is prohibited. Use Anchor Navy or Near-Black.
- **Don't** use `border-left` or `border-right` wider than 1px as a colored accent stripe on callouts, alerts, or list items. Rewrite with a tonal background tint, a full border, or a leading icon.
- **Don't** build identical card grids (same-size card, icon + heading + text, repeated). Use the affordance the content actually needs.
