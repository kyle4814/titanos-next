# Scroll jank receipt, titanos.tech mobile (2026-10-13)

Branch myelin/b-site-scroll from main b8c68de4. Not pushed, not deployed.

## Method (OBSERVED, local)
`scripts/scroll_perf.mjs <outDir> <path> <label>`: serves `out/` locally, playwright chromium, 390x844 @3x, iPhone UA, touch,
4x CPU throttle. Scrolls top to bottom with REAL touch swipes (CDP Input.synthesizeScrollGesture, 600 px strokes), records rAF
frame gaps, PerformanceObserver long tasks and a Chromium trace. Median of 3 runs. Janky frame = gap over 25 ms (1.5 frames at 60 Hz).
Headless GL is software-rendered and the box is loaded by cron, so read ratios, not absolutes. ABL=<name> env ablates one layer.

## Root cause (not the one the last pass assumed)
The previous commit (b8c68de4) added a `@media (max-width:768px)` block in globals.css that set `animation: none` on the
decorative layers. It was NOT effective: the rules were non-important and lost the cascade to design-system.css, charts.css and
VaultBackground's inline `<style>` (same specificity, later in source). `document.getAnimations()` while scrolling `/` on a 390 px
viewport still showed running: w4-twinkle (star dots), fx-breathe on every .w4-card / hero chart / orbit ring / thread pulse,
vault-keyhole-pulse, 3 vault-drift blobs, vault-specular-sweep, w4-spin. Each frame they forced style recalc + layer commit
(UpdateLayoutTree ~1,030 calls, Commit ~7.8 s, Layerize ~3.7 s over the scroll). Ablation "all animation off" took median frame 67 ms -> 17 ms;
backdrop-filter, blend modes, grain, lattice, GL canvas ablations each moved little (noise-level).

## Fix (mobile only, max-width 768px; desktop untouched)
- globals.css: hold block now uses `!important` and covers .vault-edge-thread, .offer-popular-badge, .fx-pulse, .fx-thread__pulse,
  .ds-deepfield__img, .vault-blob, .vault-keyhole, .w4-star-dot, .w4-orbit-spin, .w4-orbit-ring, .w4-hero-chart, .w4-card,
  .w4-second-look, .w4-panel, .ambient-depth::before, .hud-panel::after. Breathing layers sit at the midpoint of their opacity range.
- `.vault-specular` (80vw x 200vh screen-blended fixed sweep) hidden on phones.
- VaultKeyhole gets class `vault-keyhole` (its animation is inline style; `!important` beats inline).
- Not done on purpose: content-visibility:auto (would change page height and shift ScrollTrigger/FlowDriver offsets; not needed once animations were held), backdrop-filter changes (measured no effect; only Nav, StickyMobileCta, MusicToggle use it, blur 4-8 px).

## Before / after (median of 3, touch swipe scroll top to bottom, 4x CPU)
| page | metric | before | after |
|---|---|---|---|
| / (36,898 px) | median frame | 100 ms | 16.7 ms |
| / | janky frames | 99.9 % | 6.5 % |
| / | p95 / longest frame | 150 / 483 ms | 50 / 150 ms |
| / | long tasks (count / total ms) | 111 / 8,220 | 2 / 208 |
| /engineering (9,938 px) | median frame | 83 ms | 16.7 ms |
| /engineering | janky frames | 96.3 % | 3.1 % |
| /engineering | p95 / longest frame | 133 / 500 ms | 16.8 / 67 ms |
| /engineering | long tasks (count / total ms) | 3 / 231 | 0 / 0 |

Frame counts differ (961 vs 3,834) because the swipe takes a fixed wall time: more frames delivered = smoother.
## Gates
`npm run build` OK (JS budget max 213 KB gzip), `npm test` 25/25 hud + all suites pass.
## Unknown
Not measured on a real iPhone (WebKit). Chromium emulation is the proxy; real-device confirmation is the kill test.
