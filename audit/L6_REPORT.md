# L6 report: titanos.tech at 390 / 768 / 1440 (2026-10-09, branch myelin/b-site-l10, base bf3aba17)

Tool: `node scripts/l6_scan.mjs out <dir>` (reduced motion on; `SHARD=k/n` to parallelise, `ROUTES=` to filter, `SHOTS=1` for full-page PNGs).
Checks: horizontal overflow, text clipped by its own box, controls overlapping controls, text hidden under a control, console errors. Tap targets under 44 px are counted but informational (about 6,100 per 177 scans; not fixed here).
Scope: 236 static routes x 3 widths = 708 scans.

## Scan false positives removed (tool fixes, not site fixes)
Closed FAQ answers (`inert`, clipped to 0 rows), closed `<details>` (the /audit order form), wrapped inline links whose bounding boxes overlap, and text under the fixed bottom CTA bar (it scrolls away). First raw run: 78 of 708 flagged. After these tool fixes: 37.

## Real defects fixed
1. /refer (x3 widths): the partner form was an iframe of vault.titanos.tech, which answers `X-Frame-Options: SAMEORIGIN` (and 404 on GET /partner on 2026-10-09), so the page showed a dead frame plus a CSP console error. Replaced by a link-out card that keeps the ?ref= / ?src= attribution. Before/after: `audit/l6/shots-before|after/refer-*.png`.
2. Every page: duplicate React key `/contact` in the footer (two links to /contact). Key is now href+label.

## Open (not fixed), EV3
React error #418 (hydration mismatch) on `/` and `/methodology`, all three widths.
- SEARCHED: those two routes only; no HTML nesting violations in the built HTML (p/a/button containing blocks); no Date/random in the shared server components.
- TESTED: not reproducible in `next dev` (with or without reduced motion), not reproducible in the production build with reduced motion OFF and no scrolling (it appears under the scan, which sets reduced motion and scrolls).
- TRIED: disabling Turbopack minification (React itself stays minified, so no message text).
- WOULD FLIP: a React development build of the production bundle, or bisecting the home/methodology sections under reduced motion + scroll.

## Result
Final scan: 708 scans, 6 flagged, all the open #418 above (0 overflow, 0 clipped, 0 overlap, 0 other console errors).
