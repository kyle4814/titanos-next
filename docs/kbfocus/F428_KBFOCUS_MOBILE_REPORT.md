# f428_c10 keyboard-focus sweep, MOBILE viewport (390x844), 2026-11-11

Method: `npx next build --webpack`, then `node scripts/obelisk_rendered_keyboard_focus.mjs --out out --all --viewports mobile --concurrency 8 --shard K/5` for K=0..4 (shards are 0-indexed), merged with `scripts/merge_allpages_reports.mjs`. Base: web/f420_c10_sweeps_use_export_manifest-2026-11-11 (196271c4e). Raw merged report: `docs/kbfocus/f428_kbfocus_mobile_report.json`. Guard: `scripts/test_kbfocus_mobile_report.mjs`.

| viewport | pages_total | pages_swept | with_defects | source |
|---|---|---|---|---|
| mobile | 266 | 266 | 16 | this run (f428) |
| desktop | 267 (old manifest, incl. 404) | 267 | 15 | f414 report, f420 re-confirmed 15 |

Shard results: 54/54 with 3, 53/53 with 2, 53/53 with 4, 53/53 with 2, 53/53 with 5. Shard 0 first run had a harness ERROR on /our-scan (page.evaluate: Execution context was destroyed, intermittent, 2 of 4 runs); re-run swept clean.

## Desktop vs mobile
- Both viewports (15): /labs, /labs/issue-001..009, /labs/issue-001/scorecard (REVERSE_MISMATCH), /our-scan (REVERSE_MISMATCH), /our-evidence-pack (NO_INDICATOR), /refer (UNREACHABLE + NO_INDICATOR), /v/titanos-pitch (TRAP).
- **Mobile-only (1): /efficiency, TRAP** ("no return to document or wrap within 44 presses (N=39, 44 distinct stops)").
- Desktop-only: none.
- Caveat: the desktop side is the f414 report (older manifest), not re-run in this lane; the per-page defect set matches f420's 15.

## Backlog line (not fixed here; f421 owns desktop fixes)
BACKLOG mobile-only: /efficiency keyboard trap at 390px (focus stops exceed 44 presses without wrapping).
