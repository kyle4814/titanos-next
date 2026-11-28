# TITANOS — SCREENSHOT-FAITHFUL WEBSITE BUILD / QA / STAGED HANDOFF
## CLAUDE CODE RUNBOOK: PRESERVE SOURCE, BUILD EXACT IMAGE COMPOSITION, TEST REAL NEXT.JS STATIC EXPORT, KEEP LIVE SITE UNTOUCHED
### Visual acceptance, asset integrity, source-backed proof, navigation and mobile, independent QA, final branch handoff

DATE: 2026-11-28
SOURCE: kyle4814/titanos-next
INSTRUCTION BRANCH: design/titanos-proof-economy-obsidian-gold-redesign-2026-11-28
MASTER: docs/ops/site-redesign/TITANOS_PROOF_ECONOMY_MASTER_REDESIGN_NUKE_2026-11-28.md
All V01–V16 acceptance rules in master apply. The following tests are NOT currently asserted to have passed. Implement actual executable cases for core functionality and run them against final code.

# 1. PHASE ZERO — UNDERSTAND THE REAL SOURCE / DEPLOYMENT

A1: Start at actual checked-out git SHA of titanos-next. Read README, CLAUDE.md / AGENTS.md, package.json, next.config.ts, app/page.tsx, components/hero/Hero.tsx, Nav, Footer, CSS, stats, ledger, cases and /proof routes. Read brand bible for tone.
A2: Discover whether newer implemented redesign branch or local dirty worktree exists. Do not overwrite another engineer. Branch-isolate from latest reviewed source and retain instructions.
A3: Confirm actual production deployment and what currently serves titanos.tech; README's historical "Phase 1 NOT deployed" may be stale. Read actual CI/workflow/deployment settings if available; don't make a live deploy.
A4: Baseline npm ci if feasible and npm run build / npm test under installed Node/Next version. Record commands, environment, SHA and observed failures; pre-existing failures distinguish from redesign bugs.
A5: Image intake: owner sends REF_HOME, HERO_MOUNTAIN, TITANOS_BUILDING, perhaps brand logo. Confirm local paths and SHA/dimensions/embedded logo/copyright. If not yet delivered, build layout with explicit ASSET_PENDING and no false screenshot match claim.
A6: Record exact working route links for /app, /book, /find, /offers, /products, /proof, /case-studies, /contact and services.
A7: Audit four KPI fields, proof PDF existence vs web links and actual featured case-study source; screenshot percentages rejected if unsupported.
A8: Choose maintainable small scoped modules; do not rewrite unrelated 68 routes or all global tokens.
Phase0 output <=1 page of BASELINE_AND_ASSETS.md with code SHA, source state, assets status, route/claims mapping, baseline tests and deployment isolation. Then CODE.

# 2. ENGINEERING WORK OWNERSHIP

If parallel agents justified use at most:
- A Frontend integrator for homepage modules, source images and scoped CSS.
- B Evidence+copy reviewer for lib/ledger, cases and proof route, no numerical fabrication.
- C Independent QA reviewer for screenshots, regression, SEO and accessibility at final SHA.
No concurrent editing same app/page or stylesheet; one lead integrates. No live scan, Stripe checkout or booking/form submissions, no unrelated repository modifications.

# 3. IMPLEMENTATION WAVE 1 — HEADER / HERO / FOUR STATS

B1. Build new scoped homepage modules/visual tokens, image variants and screenshot reference; never flatten website as screenshot.
B2. Navbar left angular gold T+TITANOS, center links and gold CTA matched to screenshot. Preserve mobile drawer, ESC/focus and all secondary routes.
B3. Hero left eyebrow/H1/gold LIVE/copy and CTAs; right EXACT mountain photo with black scrim, right-weighted T visible, ridge/fog. Art-directed mobile crop.
B4. Four stat cards equal-height, aligned icons and readable source labels. Data from verified ledger/stats/cases only or qualitative facts. Never fake 1.24M/98.7/36000/72.
B5. Capture actual browser shots at 1440x900 and 390x844. Verify hero alt/decorative status, CTA hrefs, element layout and source binding.
Exit W1: visually close first fold with original owner mountain artwork and source-aware cards. If actual photo missing, ASSET_PENDING, not complete.

# 4. WAVE 2 — PROOF AND SERVICES

C1. "Receipts, Not Claims" vertical gold rule and 3 real dossier links. Actual PDF file path or HTML proof page; no fabricated download sizes/buttons.
C2. Four service cards AI Engineering / Automation Systems / Enterprise Demos / Growth Infrastructure with actual content and href; 4→2→1 responsive grid, correct icon/arrow and focus.
C3. Existing proof, offers and services routes preserved.
C4. Validate file bytes/size if shown, document source status and no fabricated outcomes.
Exit W2: cards work, match visual spacing and navigate to actual content.

# 5. WAVE 3 — BUILDING / CASE / PROCESS

D1. Use exact owner building source with correct crop/signage and gold interior, optimized desktop/mobile. Caption visibly "TITANOS architectural concept — AI-generated visualization." Never label HQ.
D2. Match case text-left/image-right, optional sourced result panel. If numeric claim unverified use source and process badges, no fake 72% margin uplift.
D3. Feature actual lib/caseStudies entry classification REAL/MODELLED/SYNTHETIC and link to correct /case-studies/{slug}. No cross-case metric mixing.
D4. Four-step Intake/Build/Prove/Scale model, connector arrows, semantic order and readable copy.
D5. Trust strip nonmisleading, footer legal/privacy/security and contact/offer links.
Exit W3: full page composition close to screenshot with accurately captioned building photo and source-linked case copy.

# 6. WAVE 4 — PREMIUM POLISH

E1. Tune focal positions and relative spacing at 1440,1920,1024,768,390 widths. Document chosen crop CSS and image sizes.
E2. Subtle metallic gold CTA and 1px borders, consistent icons/typography/black-glass cards. No large neon glow on everything.
E3. H1 white + gold LIVE, readable on narrow screens. Copy not tiny, one h1.
E4. Section pacing like reference: hero/stat/proof/services/case/process/trust/footer. Remove unrelated long homepage content only with intentional route preservation; keep long-form on existing subpages.
E5. Brand bible direct, precise and calm, real facts. No fictional customers/ROI.
E6. Light purposeful animation; respects reduced motion, no performance-heavy WebGL/canvas replacing provided photos.
E7. Keyboard, focus, contrast, alt/captions, accessible tap areas and error handling.
E8. True side-by-side screenshot review at full page; record meaningful differences with exact source shots.
Exit W4: reviewer documents layout/art mismatches honestly and critical defects fixed.

# 7. SOURCE AND ASSET GATE TESTS

T01 HERO_SOURCE_HASH: owner actual mountain received, source SHA recorded, derivative trace exists and image loads.
T02 BUILDING_SOURCE_HASH: actual user building file received, image correct, concept label visible.
T03 REFERENCE_COMPARISON: screenshot used as target; page reconstructed in semantic HTML/CSS.
T04 IMAGE_DECODE: all responsive sources decode, no broken URLs; dimensions known.
T05 LCP: suitable image preload/prioritization, actual measured performance if possible. No giant base64 inline.
T06 CLS: explicit layout/asset dimensions; actual measured shift when supported.
T07 RESPONSIVE: 320,390,768,1024,1440,1920 tests no overflow or hidden essential controls.
T08 IMAGE_FOCUS: mountain gold T and building TITANOS sign remain visible on supported sizes.
T09 REDUCED_MOTION: CSS/JS honors preference, no unavoidable large animation.
T10 ASSET_RIGHTS: original owner source/derivative hashes and concept provenance; no unrelated unsafe stock image.
T11 ORIGINAL_FILES: do not overwrite unrelated NASA/poster sources used elsewhere.
T12 EXIF: no unneeded GPS/private metadata in published images.

# 8. SOURCE AND CLAIM GATES

C01 Four homepage metric values have explicit real source or become qualitative; screenshot arbitrary numbers not copied.
C02 Modelled/unsourced row retains correct label; no unsupported financial ROI.
C03 As-of/method/scope near number; no global rate inferred from small experiment.
C04 Dossier actual PDF with correct size or honest HTML proof link, never fake.
C05 Featured case and stats from same real case entry with correct label and destination.
C06 Building disclosed AI concept; no HQ/customer claim.
C07 Trust strip no invented clients/partners/certification.
C08 Live text semantic and selectable; no screenshot text as single flattened image.
C09 Service card route actually matches described offer.
C10 Enter TitanOS portal only if actually tested and live; fallback CTA has working route.
C11 Current year, SEO metadata, actual OG image if referenced.
C12 Private case/customer information remains redacted.
C13 Source-backed proof route works, existing test logs intact.
C14 No altering ledger generation to force screenshot metrics.
C15 Static site older unsourced "1,700 scans" figure is NOT resurrected.
C16 All claims are audited with VERIFIABLE / MODELLED / REPLACED statuses.

# 9. TECHNICAL AND ROUTE REGRESSION

R01 npm run build returns real exit 0 on recorded source SHA; static export works with Next 16 config.
R02 npm test executed and report actual outcomes, separating pre-existing baseline failures.
R03 npm run seo and link map on built output where scripts available.
R04 npm run gates:built / gate:reduced-motion / kbfocus where applicable and correct run order.
R05 npx tsc --noEmit real output/exit.
R06 Browser routes /, /proof, /case-studies, /offers, /book, /contact, /privacy, /terms, /security, /credits all valid.
R07 Nav desktop/mobile accessible: hamburger, ESC, focus, scroll lock, gold CTA.
R08 Export includes all images and file links, no reliance on unavailable Next image optimization runtime.
R09 Existing forms/payment/portal endpoints NOT mutated; no production POST.
R10 app/layout.tsx CSP unchanged unless strictly justified and no remote untrusted scripts.
R11 Do not disable source/security tests to get green.
R12 Canonical, sitemap, JSON-LD, OG and favicons remain valid.
R13 Nav simplification doesn't bury /scan, /compliance, /ai-delivery and legal.
R14 Representative non-home route visual regression: /black-ice, /ai-delivery, /pricing, /proof.
R15 No HTML injection from data/copy or open redirect from changed CTAs.
R16 Print/reduced-motion and tab order remain usable.

# 10. ADVERSARIAL RED TEAM

Reviewer gets exact branch/source SHA, owner original screenshot, mountain art, building source, final screenshots and proof mapping. Check:
- hero really uses supplied art and matches screenshot, not generic sci-fi replacement;
- correct left text/right T layout on desktop/mobile with visible sigil;
- office image concept disclosed and not misrepresented as actual HQ/client;
- percentages and "enterprise trust" claims sourced/replaced;
- all three dossier cards open actual asset/page;
- all CTAs resolve and offer matches label;
- static-export and 68-route regression not broken;
- actual LCP/motion/accessibility measured where possible;
- no external production calls or live deployment;
- photos rights/provenance and no secrets;
- actual final code SHA and screenshots.
Verdict: ACCEPT_PREVIEW, ACCEPT_WITH_BACKLOG, BLOCK_VISUAL, BLOCK_CLAIMS, BLOCK_SECURITY, ASSETS_MISSING, TESTS_PARTIAL. Serious fixes require re-review updated code SHA.

# 11. DEPLOYMENT AND ROLLBACK

Instruction docs do not deploy. Actual Next website code changes in separate isolated review branch. No automatic merge into main.
Historical source repo README described legacy kyle4814/titanos-tech static website serving titanos.tech and titanos-next as not yet deployed; may be stale. Determine current production from actual deployment/CNAME/Cloudflare config and ask owner only if action requires confirmation. NEVER deploy this redesign without new explicit instruction.
Local testing with npm run dev and static export. Preview link only if safe pre-existing authorised preview mechanism; no surprise DNS/Cloudflare/API changes.
Preserve rollback pre-change SHA and source image path; no deleting case studies or evidence.
No false "zero downtime" without measured deploy.

# 12. ACTUAL OWNER REVIEW PACKAGE

1. Exact implementation branch/final SHA and changed code files.
2. Original photo inventory (actual 3 files received, SHA, dimensions), optimized derivatives and manifest, missing sources if any.
3. Real browser screenshots desktop 1440 full page, 390 mobile, hero and case closeups, with viewport and source SHA.
4. Visual comparison table MATCH/MINOR/MATERIAL/NOT_IMPLEMENTED to owner reference.
5. Claims mapping for 4 stats, 3 proof cards and case metric/trust strip, source+date.
6. Actual executed build/test commands and results PASS/FAIL/NOT_RUN, independent QA findings.
7. Links/CTAs working and live untouched confirmation grounded in repo actions.
8. Next owner action: approve visuals or request precise tweaks; later separately authorize deployment.

A GitHub document commit is NOT completed website implementation. Never claim redesign shipped if no actual code/screenshots.

END. Prioritize visual fidelity to owner's image, verified claims, mobile and a clean safe preview. BUILD IT, TEST IT, SHOW IT, HAND IT OFF.
