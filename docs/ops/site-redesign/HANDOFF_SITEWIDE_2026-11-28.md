# Sitewide obsidian and gold handoff, 2026-11-28

Branch: build/sitewide-obsidian-gold-2026-11-28 (foundation fe9686409 plus 19 merged page-group branches sitewide/g1 to g19, plus one integration commit and one cleanup commit). Final SHA: see the pushed branch head (git rev-parse origin/build/sitewide-obsidian-gold-2026-11-28).

## Pages and status
All restyled, content unchanged: g1 about, mission, partners; g2 agents, ai-delivery, engineering; g3 app (login, billing, keys, estate, partner), pro, welcome/[slug]; g4 audit, audit/booked, book, book/confirmed, contact; g5 black-ice (index, doctrine, dossiers), x-ray, security; g6 blog and 21 posts; g7 case-studies (all), declaration, our-evidence-pack; g8 compliance, privacy, terms, your-data; g9 costs, pricing, efficiency; g10 courses, learning-loop, methodology and related; g11 credits, deep-field, parallax, v/titanos-pitch; g12 find, faq, demo/tix (4 sub-routes); g13 enterprise, sectors (10), tradies; g14 speed, system, how-it-works; g15 hud, status, open-data; g16 investors, refer; g17 scan, leads; g18 monitor (3), offers (index and all), services; g19 proof, trust. app/shop, app/products, app/order untouched.
Integration fixes: proof headings restored to single text node so the case trace manifest matches; book form keeps source-level 44px and 16px tap targets; /pro white-label sample table ink fixed and Leads buttons restyled; public/labs static pages (index, 12 issues, scorecard) moved to obsidian and gold palette (scorecard defaults to dark, theme toggle kept); removed two accidentally committed portal-api/.mut-* scratch directories from g10.

## Tests
npm run build: pass, post-build checks ALL PASS. Full manifest minus test_proof_freshness.mjs and test_obelisk_kill_matrix.sh: 192 of 192 pass (first run had 4 failures: case trace x2 and book page from the merge, portal-api timeout under load; all fixed or rerun green).

## Link crawl
275 built pages, 42,653 internal href occurrences, 250 unique targets, 0 returning 404.

## Screenshots
/home/tech2/klinge-kernel/state/research/d89e1778/ocean/site_redesign_2026-11-28/sitewide/final (88 routes at 1440 and 390, all non-templated routes plus two samples per templated family; shop, products, order skipped). Contact sheet: /home/tech2/klinge-kernel/state/research/d89e1778/ocean/site_redesign_2026-11-28/sitewide/final/contact-sheet-1440.png

## Known gaps
No independent reviewer subagent was available in this run (no agent-spawn tool); contact sheet and diff were reviewed by the integrator. Labs pages are static HTML, recoloured only, not rebuilt on pe components. Full-page screenshots taken with reduced motion on.
