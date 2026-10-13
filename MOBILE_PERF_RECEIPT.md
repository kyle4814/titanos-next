# Mobile smoothness receipt, titanos.tech (2026-10-13)

Branch myelin/b-site-mobile from main f2f17114. Not pushed, not deployed.

## Method (OBSERVED, local, throttled)
`scripts/mobile_perf.mjs`: serves `out/` locally, headless Chromium (playwright), 390x844 @2x, touch, 4x CPU throttle,
no network throttle, no compression on the local server (JS KB below are raw bytes, not on-wire gzip/brotli).
Median of 3 runs: transfer, LCP, CLS, long-task TBT, then a 40-step scroll top to bottom with rAF frame gaps and CDP
Performance metrics. Headless WebGL is software-rendered, so GL cost is overstated against a real phone GPU.
Lighthouse not used (snap chromium not driven; playwright chromium used instead). Run to run noise is large (cron load on the box): treat ratios, not single numbers.

## Measured picture (home, before)
- Page is 37,700 px tall (45 viewports), 2,115 DOM nodes, 83 requests, ~2.1 MB raw (JS 1.25 MB raw, fonts 130 KB, HTML 361 KB, images ~190 KB). Per-page first-load JS budget (js_budget.mjs) 213 KB gzip: fine, no change needed.
- CLS 0.506 and LCP ~2.5 s: app/loading.tsx made every route a Suspense boundary; the whole page was a hidden `<div id="S:0">` swapped in by a `$RC` script at the END of the 370 KB HTML. Users saw a spinner with the footer right under it, then 35,000 px of content inserted at once (footer jumped 419 -> 35,846 px).
- Scroll main-thread (2.4 s window, 4x throttle): ~2.3 to 2.8 s task time, i.e. saturated. By ablation: WebGL layers ~1.1 s (software GL), infinite CSS animations ~0.9 s (style recalc 417 ms vs 96 ms with animation off), GoldDust full-screen fixed 2x canvas ~0.5 s, Lenis/GSAP ~0.2 s.
- Not causes (grep clean): no background-attachment: fixed, scroll listeners are passive and rAF-batched (FlowDriver, HeroScrollCue), GL loops already pause off-screen and drop to 30 fps and 0.3 to 0.8 scale on phones, no autoplay video on home (13 MB pitch mp4 only on /v/titanos-pitch), images are avif/webp with srcset, polling is a 60 s feed that pauses when hidden.

## Fixes (look kept)
1. Deleted app/loading.tsx (the Suspense spinner boundary): content is now inline HTML, painted progressively. LCP and CLS.
2. StatsTicker reserves 2 lines under 640 px (the 22 -> 44 px line wrap was a second, smaller shift).
3. GoldDust skipped on phones/touch (<768 px or coarse pointer), pauses on hidden tab.
4. MotionLayer: Lenis not loaded on coarse pointer (native touch momentum; it only added a rAF loop). GSAP reveals kept.
5. VoidPortal: 30 fps and 0.4 buffer scale under 800 px (was 60 fps).
6. Under 768 px the decorative infinite animations hold still: vault blobs, fx-pulse/fx-thread__pulse breathe, edge-thread shimmer, offer badge shimmer, w4-star twinkle. The mobile specular sweep was left running (tuned on purpose for phones).

## Before / after (home /, medians, 4x CPU throttle)
| metric | before | after |
|---|---|---|
| LCP | 1.9 to 2.6 s (2,520 typical) | 0.38 s |
| CLS | 0.506 | 0.004 |
| TBT (long tasks over 50 ms) | 1,630 to 2,950 ms | ~1,160 ms |
| long tasks | 33 to 43 | 22 |
| scroll main-thread task time | 2,300 to 2,760 ms | ~1,520 ms (960 ms with GL off) |
| scroll frame gap p95 | 167 to 267 ms | 150 ms |
| style recalc during scroll | 380 to 417 ms | ~300 ms |
| transfer | 2.1 MB raw | 2.1 MB raw (unchanged, not the problem) |

## Left (UNKNOWN on real hardware / next)
- Software GL dominates what is left; real-phone GPU cost is not measured. Next lever: a real-device or WebPageTest run, then halve POINTS in HeroStage under 600 px if it still janks.
- 2,115 DOM nodes / 37,700 px page: content-visibility: auto on the below-fold sections would cut style/layout further (needs a visual check).
- Backdrop blur on fixed Nav/StickyMobileCta/MusicToggle: ablation showed no measurable gain, left.
- Gates: `npm run build` PASS (budget 213 KB max), `npm test` PASS (all suites).
