# Old homepage preservation map, 2026-11-28

Old = app/page.tsx and its components at 24bd67501d (site-truth-2026-11-27). New = this build branch.

Items: 35. MAPPED (already lived elsewhere in the new design): 5. RESTORED (brought back into the new design): 24. DROPPED: 6, all decorative or replaced by the owner's art; none carried a claim, price, link or contact route.

| # | Old item | New location | Status |
|---|---|---|---|
| 1 | Hero: PhiWordmark above the headline | Nav and footer wordmark (same PhiWordmark component) | MAPPED |
| 2 | Hero eyebrow: The birth of a global intelligence system, measured on itself | Ledger line section under the metric cards (kicker) | RESTORED |
| 3 | Hero H1: 67.6 engineer-years of output in 5 months (ledger-bound) | Ledger line section (h2), same ledger rows | RESTORED |
| 4 | Hero strip: HERO_STRIP, re-measured date, lines, repositories, MODELLED COCOMO label | Ledger line section | RESTORED |
| 5 | Hero paragraph: cost per matched job US$0.97 to US$0.12 (25 jobs), main engine test cases | Ledger line section | RESTORED |
| 6 | Hero CTA: See the receipts to /proof | Hero View Proof button and ledger line link | MAPPED |
| 7 | Hero NASA black-hole poster and credit link /credits#nasa-black-hole-jet | Replaced by the owner's mountain T art (Kyle's brief). Credit entry stays on /credits; image files stay in public/ | DROPPED (replaced by owner art) |
| 8 | HeroMesh, FlowThread, fx-bleed parallax and the Webb cosmic-cliffs backdrop with its credit link | Decorative motion and background art. The /credits entry and the public/space files remain | DROPPED (decorative) |
| 9 | Find the right offer in 30 seconds, /find and /offers | FindOffer row under the trust strip | RESTORED |
| 10 | Inscription: US$0.97 to US$0.12 label, The machine carries the complexity / You keep the judgement, sub copy | Same Inscription component, kept on the page | RESTORED |
| 11 | StatsTicker rotating credibility line | Kept (same component) | RESTORED |
| 12 | Intro paragraph: You know the work that eats your week ... They get their hours back | Kept (same copy) | RESTORED |
| 13 | CTA: Book a free call with Kyle to /book; See how it works to /how-it-works; No cost, no obligation | Kept; buttons restyled gold and dark | RESTORED |
| 14 | Trust bar: 226 domains, 957 organisations (stats.json), ABN 34 318 502 254, Personally reviewed by Kyle | Kept (same TrustUnit and NumberCounter) | RESTORED |
| 15 | Hours counter (HoursCounter) | Kept | RESTORED |
| 16 | Evidence pack link to /our-evidence-pack | Kept, plus a Receipts card and a footer link | RESTORED |
| 17 | Latest build or hero case study link, and See the case studies to /case-studies | Kept (consent-gated Ariance logic intact) | RESTORED |
| 18 | HeroScrollCue | Decorative scroll hint | DROPPED (decorative) |
| 19 | Free consultation section: heading, lead, four steps I to IV, and the line If there's nothing worth automating yet | Kept (same words). The GSAP gold thread drawing is replaced by four static cards | RESTORED (animation dropped) |
| 20 | ContactButtons: Book a call, Telegram @TitanOSofficial, Email kyle@titanos.tech, reply-time note | Kept inside the free consultation section | RESTORED |
| 21 | Go deeper doors: The proof, Partnerships and prices, How it works, What we automate, Who builds it, The learning loop (with one-line blurbs) | Kept (blurbs included); folds to two at phone width via PhoneFold, all stay in the DOM; links also in the footer | RESTORED |
| 22 | FrontLoad: Straight answers, 12 questions (monthly retainer, 3-month minimum, not a tech business, time, ChatGPT, if it breaks, who are you, data safe, safe, replace staff, how do you know, cost, IT provider, what next) | Kept (same component and copy) | RESTORED |
| 23 | PricingGlance: all five price rows, Book a free call, See every price | Kept, restyled into the card language; amounts untouched | RESTORED |
| 24 | OpenLoop: You have seen the receipts ... | Kept | RESTORED |
| 25 | Analogy healthcheck | Kept | RESTORED |
| 26 | FreeStart closing block | Kept | RESTORED |
| 27 | divider-gold rule | Decorative | DROPPED (decorative) |
| 28 | Global nav: 35 LINKS in the drawer, desktop strip (Find offer, Offers, Case studies, AI, Compliance, Monitor, Blog, About) and More menu | Homepage only: Platform and Products menus, Proof, Case Studies, Contact; mobile drawer and the footer All pages list carry every LINKS entry. Other routes keep the old Nav untouched | MAPPED |
| 29 | Nav gold CTA: Book a free call with Kyle to /book | Nav CTA is Enter TitanOS to /app (Kyle's reference). Book a free call is in the hero ledger section, the footer Ready to Build box, the sticky phone bar and the pricing block | MAPPED |
| 30 | Footer columns Services, Proof, Company (about 40 links, incl. /faq, /sectors, /deep-field, /ai-readiness-guide.pdf) | New footer columns plus the All pages list; the four links found missing by the crawl were added | RESTORED |
| 31 | Footer identity: Kyle Deligny, Brisbane, ABN; Built without asking; I personally review every deliverable | New footer | RESTORED |
| 32 | Footer SigilSeals and the 'Every symbol means something' line | Decorative | DROPPED (decorative) |
| 33 | Sticky phone Book a free call bar, Find my offer chip, music toggle | Kept on the homepage (all three still render) | RESTORED |
| 34 | Vault edge thread, ambient grain layers on / | Decorative background layers, quietened on / only | DROPPED (decorative, / only) |
| 35 | SEO: title, description, canonical, OG, JSON-LD (organisation, website) | Unchanged | MAPPED |

## Deletion check

`git diff --name-status 24bd67501d` shows no deleted or renamed files. Route directories under app/ and every file under public/ are untouched. Modified: app/page.tsx, app/credits/page.tsx (one added paragraph), components/Nav.tsx and components/Footer.tsx (a pathname switch; other routes render the original components unchanged), scripts/test_manifest.txt (one added test).

## Link coverage

Every href in the old homepage sources (page, hero, SalesKit, ContactButtons, PricingGlance, Footer, navLinks, config) was compared with every href in the built out/index.html (header, drawer, body, footer). Before the footer fix four were missing (/ai-readiness-guide.pdf, /deep-field, /faq, /sectors); they are now in the footer. Result in the handoff doc. Crawl of every internal link on the built homepage and footer: zero non-200 responses against a local static server.
