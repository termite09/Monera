---
target: Insights
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/Users/termite/monera/src/app/(auth)/insights/page.tsx"
target_fingerprint: "sha256:b407cae0ffb56cb55d42746bbd2b414b3c905573ff00e9a4cc9be3693f683102"
target_path: /Users/termite/monera/src/app/(auth)/insights/page.tsx
timestamp: 2026-10-11T12-21-24Z
slug: src-app-auth-insights-page-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

## Insights — Design Health 23/40 (Acceptable)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | Header control changes per tab, blank on Subscriptions; running period looks like a cheap month |
| 2 | Match system / real world | 3 | Merchants vs places |
| 3 | User control and freedom | 2 | Hide has no undo; restore all-or-nothing; tab not in URL |
| 4 | Consistency and standards | 2 | Header control semantics; rent under Subscriptions tab; icon sizes |
| 5 | Error prevention | 2 | Hide on every row next to the expand target; month labels navigate away |
| 6 | Recognition rather than recall | 2 | Year chart has no values, axis or takeaway |
| 7 | Flexibility and efficiency | 2 | No sort/search |
| 8 | Aesthetic and minimalist | 3 | Name and amount ~900px apart on desktop |
| 9 | Error recovery | 3 | |
| 10 | Help and documentation | 2 | Detection unexplained; hide explanation tooltip-only |

Detector: CLI clean. In-page: only the sonner transition:height false positive. Year month buttons 27x24 on mobile (well under 44px).

Priority issues
- [P1] No insights: Year chart lacks a one-line takeaway, values and a running-period marker (DESIGN.md requires a takeaway per chart). (clarify)
- [P2] Header control means period / nothing / year depending on tab. Move each control into its tab. (layout)
- [P2] Hide is silent, no undo, focus lost, explanation tooltip-only. (harden)
- [P2] Year bars are large navy stacks against the chart rule (warm grey, navy peak only). (quieter/colorize)
- [P3] Rows too wide on desktop. (layout)
