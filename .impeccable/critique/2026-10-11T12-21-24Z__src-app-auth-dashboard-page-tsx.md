---
target: Dashboard
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/termite/monera/src/app/(auth)/dashboard/page.tsx"
target_fingerprint: "sha256:0a919422da6e2d1226cd3502b7c0b651b1c3ac4e7b15ada6ae5c2f03c459dc14"
target_path: /Users/termite/monera/src/app/(auth)/dashboard/page.tsx
timestamp: 2026-10-11T12-21-24Z
slug: src-app-auth-dashboard-page-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

## Dashboard — Design Health 28/40 (Good, low end)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Default Week chart covers days after the statement ends and says "No spending this week" |
| 2 | Match system / real world | 3 | "Month" chart mode is calendar language; Needs/Wants filling = bad, Savings filling = good, same visual |
| 3 | User control and freedom | 3 | "No" on the pay prompt navigates straight to Settings |
| 4 | Consistency and standards | 2 | Spent vs Expenses; two date navigators; 16/20/24px paddings |
| 5 | Error prevention | 3 | |
| 6 | Recognition rather than recall | 3 | Needs ring includes unpaid rent; breakdown sheet shows only spent |
| 7 | Flexibility and efficiency | 2 | No ←/→ period keys, no swipe |
| 8 | Aesthetic and minimalist | 3 | Uneven bottom row on desktop; ends on an empty chart |
| 9 | Error recovery | 3 | |
| 10 | Help and documentation | 3 | |

Specificity: copy is authored for Monera (payday sentences, freshness note); visuals are close to stock shadcn cards. Pay period has no visual form.

Detector: CLI clean (0). In-page: transition:height (sonner library, false positive), flat-type-hierarchy (sr-only h1 false positive; h2s 14/16/18px real), cramped-padding on segmented track (false positive). No overflow, no shadows at rest, all amounts DM Mono, font scale holds.

Priority issues
- [P1] Spending by day opens on an empty week after the statement ends; "Month" is calendar language. Default to Period, say "Your statement ends 12 Jun", drop Month. (distill, clarify)
- [P1] Needs ring fills with spent + bills due in one colour (85% full at €50 spent); breakdown disagrees. Two-tone ring + caption + "bills still due" line. (clarify)
- [P2] Detail sheet: full-width bottom drawer on desktop, shadow-lg, 500ms; sheets/dialogs/tooltips/skeleton ignore reduced motion. (adapt, polish)
- [P2] Budget status chips (Over budget / Target met) and status tokens not implemented. (harden)
- [P2] Desktop composition: two stacked date lines, uneven bottom row. (layout)
