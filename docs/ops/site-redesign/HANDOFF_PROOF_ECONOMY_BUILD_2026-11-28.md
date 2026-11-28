# Handoff: Proof Economy homepage build, 2026-11-28

Branch: build/titanos-proof-economy-homepage-2026-11-28, base site-truth-2026-11-27 (24bd67501d). NOT deployed, NOT merged. Code SHA tested: d7b1a9c3a (this handoff is committed on top of it, so its own hash is in `git log -1`).

## Files changed
New: components/home-redesign/{HomeNav.tsx, HomeFooter.tsx, Sections.tsx, Icon.tsx, homepageContent.ts, home-redesign.css}, public/site-redesign/* (AVIF and WebP sized variants, t-mark.png/.webp), tools/make_redesign_images.mjs, tools/make_logo_mark.mjs, scripts/test_home_redesign.mjs, docs/ops/site-redesign/ASSET_SOURCE_MANIFEST.json, OLD_SITE_PRESERVATION_MAP_2026-11-28.md, this file.
Modified: app/page.tsx, app/credits/page.tsx (one paragraph crediting the AI-generated art), components/Nav.tsx and components/Footer.tsx (pathname switch: "/" renders HomeNav/HomeFooter, every other route the original), scripts/test_manifest.txt (+1 test). Nothing deleted or renamed. No API, Stripe, booking or Worker code touched.

## Source of every number shown
| Card | Value | Source |
|---|---|---|
| Work commits | 3,543 | lib/caseStudies.ts titanos-engine facts[0]: git log, 29 Sep to 26 Nov 2026, counted 27 Nov, merges and backup snapshots excluded |
| Test suites passing | 652 / 666 | same case study: full gate reading 18 Nov 2026 (652 passed, 14 failed; 666 from facts[2]) |
| Lines of production code | 256,217 across 12 repositories | lib/ledger.json estate_sloc (MEASURED, as_of 13 Oct 2026), estate_repos |
| Lower cost per job | 8.4x (US$0.97 to US$0.12, 25 matched jobs) | lib/ledger.json cost_job_x, cost_job_before, cost_job_after (MEASURED, as_of 9 Oct 2026; date read from the ledger) |

Case outcome panel: 3,543 commits, 48 hours soak (8 of 9 checks passed, 1 open), 5 human gates, all from the same case study. Proof cards: real files with sizes read from disk at build (Declaration PDF 78 KB, evidence pack excerpt PDF 70 KB, build replay log 5.7 KB). Reference placeholders (1,240,000+, 98.7%, 36,000+, 72%, 4.8x, -86%, 4.2/2.9/7.6 MB, Trusted by) are not used; scripts/test_home_redesign.mjs fails if they appear.

Image sources:
- hero-mountain: hero-src.png (owner upload), 1199x1312 png, 2162434 B, sha256 961af5b3b28f3b15065ef22ca4535f9913b9c4745eb1c087f20b29f3765e920e
- building-concept: building-src.png (owner upload), 1672x941 png, 1834358 B, sha256 3df0ec27b64326bd2c2c494583e737f3baf5e19aa18aefd822fe86817e40577d
Derivative hashes: ASSET_SOURCE_MANIFEST.json. The building is captioned and alt-texted as an AI-generated illustrative render, and /credits says so. The header T mark is cropped from that render (about 140 px source).

## Tests (final run, after the last build)
- npm run build: pass, including postbuild gates (test_home_height 12,986 px at 390 against a 13,000 budget: thin headroom).
- npm test: the two known failures (test_proof_freshness.mjs, test_obelisk_kill_matrix.sh) excluded through a copy of the manifest; every remaining entry run to completion: 192 of 192 pass. Manifest lint OK (194 entries).
- npx tsc --noEmit: clean.
- Mid-run failures that were mine and are fixed: homepage content pinned by older tests (HoursCounter, consent-gated Ariance link, /case-studies link, pricing order) restored; reduced-motion and print gates flagged HomeNav (requestAnimationFrame, fixed header not hidden in print).
- Playwright on a local static server: 0 console errors, 55 internal links all 200, no horizontal overflow at 320/390/768/1024/1440/1920, CLS 0.0015, LCP about 250 ms locally, keyboard menu open, ArrowDown and Escape restore focus, drawer focus and scroll lock work, reduced motion disables the entrance animation.

## Screenshots
/home/tech2/klinge-kernel/state/research/d89e1778/ocean/site_redesign_2026-11-28/: desktop-1440-full.png, mobile-390-full.png, hero-closeup-1440.png, hero-closeup-390.png, case-study-closeup-1440.png, nav-dropdown-open-1440.png, mobile-drawer-390.png, full-768/1024/1920.png, reference-owner.png, side-by-side-reference-vs-build.png.

## Comparison notes
MATCH: nav, hero composition and art, gold LIVE, four-card row, receipts layout, four service cards, case layout with building and outcome panel, operating model with arrows, footer with Ready to Build box. MINOR: wordmark is the existing PhiWordmark, not the reference's spaced sans; service icons smaller. MATERIAL (intentional): metric numbers, dossier names and sizes, case headline and outcomes, trust strip wording and the hero primary CTA (See what we build to /offers) are replaced with sourced content. The page continues below the reference's trust strip with the old homepage sections Kyle asked to keep (OLD_SITE_PRESERVATION_MAP).

## Independent review
Reviewer (lucid) found: 8.4x card date typed as 8 October while the ledger says 9 October (fixed, now read from the ledger); h3 inside a span inside a link (fixed); mixed dates in one sentence (fixed); /credits did not mention the AI art (fixed). Its blank-band note was resolved by disabling scroll-reveal on the home page. Numbers, routes, sizes and disclosures held.

## Known gaps
- Nav CTA Enter TitanOS goes to /app, the existing My Level sign-in page; not tested end to end against production. Confirm or relabel.
- test_home_height has about 14 px of headroom; new homepage copy will trip it.
- Hero uses picture/img with AVIF and WebP (next/image is unoptimised under static export).
- Lighthouse not run; LCP and CLS measured by PerformanceObserver on localhost only.
- Header T mark is low resolution; supply a vector logo to replace it.
