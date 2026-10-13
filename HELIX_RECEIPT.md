# HELIX PREMIUM PASS (2026-10-13)

Kyle: "the background helix just needs to look Premium now." Branch `design/helix-premium` (worktree `~/tn-helix`),
based on main `acc230d5`. Not pushed, not deployed, main untouched.

## What changed (shared by all three variants)
`components/flow/FlowThread.tsx` (the page-long DNA braid) and `app/design-system.css` (its light rig).
- Strands are now lit RIBBONS (filled polygons), not flat strokes. Width follows depth in the twist: near face 1.45x,
  far face 0.55x. Brightness follows depth too (a `linearGradient` per strand, `userSpaceOnUse`, repeating every twist).
- Correct occlusion: each strand is split at its depth zero crossings into near and far pieces; far pieces draw first,
  near pieces last. Strands only ever cross where one is near and the other far, so every crossing stacks right.
- Light: two pre-blurred halo ribbons per strand (wide 14 and mid 6.5 units, falling opacity), a thin bright filament
  core, an optional thick glass body, and a 0.42 unit specular highlight on the near face only, offset toward the light.
  Desktop (`min-width: 769px` and `pointer: fine`) adds ONE `feGaussianBlur` (stdDeviation 3.2) on the halo group.
  Phones never get the filter: the layered halos are the blur.
- Colour: gold lifted to `#f5cd72` (dim `#9c7a35`), blue and violet desaturated (`#9fb6e8`, `#b1a3ec`) so gold leads.
- Motion: breathing slowed 8 s to 14 s, scale 1.045 to 1.01 to 1.02, opacity 0.5 to 0.72 (was 0.13 to 0.23 effective).
  `prefers-reduced-motion` rules unchanged (animation none, static tiles).
- Edges: top and bottom feather widened (18% / 82%). The tile is still 800 px (two full twists) and loops seamlessly:
  every path is periodic in TILE; checked at 5x zoom across the y = 800 join (`shots/B_seam_zoom.png`), no step.
- Mobile hold block in `app/globals.css`: UNTOUCHED (`git diff --quiet -- app/globals.css` is clean).

## The variants (one const)
`HELIX_VARIANT` at the top of `components/flow/FlowThread.tsx` sets `data-helix` on `.fx-thread`; every width, opacity
and colour weight is a CSS variable keyed off `[data-helix="A|B|C"]` in `app/design-system.css`, so one build carries all
three. To pick: change the const, `npm run build`. To preview another variant on a running build:
`document.querySelector('.fx-thread').dataset.helix = 'A'`.

| Variant | Look | Settings |
|---|---|---|
| A Gold Filament | thin, bright, precise strands with a soft halo | thin core 1.0, halos 0.05 / 0.16, far 0.6, specular 0.7, blue and violet at 0.7 |
| B Deep Glass (DEFAULT) | thick glass body with an inner filament glow, depth fog, dimmer far strand | thick body 0.6 + thin core 0.9, halos 0.11 / 0.2, far 0.38, specular 0.6 |
| C Obsidian Minimal | one gold strand dominant, blue and violet as faint ghosts, maximum calm | thin core 1.0, halos 0.04 / 0.1, far 0.55, ghosts at 0.2, no highlight on ghosts, breathe scale 1.01 |

Why B is the default: it is the only one that reads as a solid lit object rather than lines. The depth fog on the far
face plus the glass body gives the braid real volume at desktop width, and on the phone the same geometry stays calm
because the halos are soft polygons, not filters. A is B without the body (crisper, flatter); C loses the braid identity
that the rest of the page's DNA language leans on.

## Phone scroll perf (scripts/scroll_perf.mjs, home page, 390x844 @3x, touch swipes, 4x CPU throttle, median of 3)
| build | median frame | p95 | longest frame | janky % | long tasks (n / ms) | frames delivered |
|---|---|---|---|---|---|---|
| BEFORE (acc230d5) | 16.7 ms | 83.3 | 350 | 10.5 | 33 / 2,160 | 3,797 |
| A Gold Filament | 16.7 ms | 83.3 | 333 | 9.3 | 27 / 1,802 | 3,915 |
| B Deep Glass | 16.7 ms | 83.3 | 300 | 9.9 | 24 / 1,592 | 3,894 |
| C Obsidian Minimal | 16.7 ms | 83.4 | 317 | 11.3 | 32 / 2,104 | 3,831 |

All three PASS on phone: same median frame as BEFORE, more frames delivered, fewer long tasks (A, B). C's 11.3% janky
sits inside the run-to-run noise of this probe (BEFORE measured 6.5% on the morning receipt and 10.5% now, same
build); C is the same geometry as A and B with lower opacities, so it cannot cost more. No variant needs a lighter
fallback beyond the one built in (no SVG filter on phones). Raw JSON: `/tmp/ksc/helix_*.json` at run time.

## Cost
- Home HTML: 367 KB to 410 KB raw (54 KB to 66 KB gzip): the ribbon geometry, carried twice (markup + RSC payload).
  No new JS. JS budget: max route 212.8 KB gzip, budget 250 (was 212.2).
- `scripts/scroll_perf.mjs`: optional `HELIX=A|B|C` env to measure a variant on one build (one line).
- `scripts/shoot_helix.mjs`: the screenshot helper (phone 390x844 @3x and desktop 1440x900, hero and the "Find the
  right offer" section, plus a desktop column crop). Shots live in `~/tn-helix/shots/` (28 MB, not committed).

## Gates
`npm run build` OK (postbuild: og, proof numbers, js budget all pass). `npm test` OK (543 PASS lines, 0 FAIL).
Zero em or en dashes in every file written. Telegram: 4 of 4 sendMediaGroup calls returned ok:true (BEFORE, A, B, C).

## Not done, on purpose
- HeroStage WebGL knot (secondary layer) untouched: beside the new braid it still reads fine in the hero shots.
- FlowDriver's 0.42x scroll factor untouched (heavier motion came from the breathing, not the parallax rate).
- Not measured on a real iPhone (WebKit). Chromium emulation is the proxy; a real-device check is the kill test.

## Commit
See the line appended below after the commit.
