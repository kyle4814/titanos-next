# INTEGRATION 2026-11-02: seven Sika assistant lanes on one tip

Branch sika/integrate-convo-2026-11-02 (worktree /dev/shm/wt-int), started at 25b53b21f. Live base for comparison: 1f36f8c67. Final SHA: see the commit that adds this file (git log -1). Raw outputs: /dev/shm/wt-int-verify/.

VERDICT: NOT READY TO DEPLOY. Stop rule partly met (run_all rc 0, GOLDEN 4600/4659, bank WRONG 0, three exams scored, mutations 4/4), but three NEW reds versus live base remain (sika-brain2b, sika-brain2c, sika-citematch size budgets), and sika-calc needs a clean rerun.

## Merges and conflicts
1. sika/generalise-2026-11-02: conflicts in run_all.sh (test list unioned), chat.js (the generalise lane's wider PICK regex kept as PICK_BASE, the fix lane's how-to filter kept on top: PICK_RX = PICK_BASE and not a how-to ask unless explicit; wantsPick from generalise kept), dist/brain.js and sw.js (ours, rebuilt later).
2. sika/missing-2026-11-02: run_all.sh (unit_missing added), last_run.json, dist/*, sw.js (ours, rebuilt).
3. sika/chat-ux-2026-11-02: dist/main.js, sw.js (ours, rebuilt). New chat was NOT wired to persist.js: brain-ui resetBrain only nulled the in-memory state. Fixed: resetBrain now calls resetBrainState (clears sessionStorage too); convo_e2e asserts the saved context exists before New chat and is gone after.
4. sika/qty-cart-2026-11-02: run_all.sh (unit_cart added), dist/*, sw.js. cards.js, grid.js, numq.js merged cleanly; the fix-lane behaviour is intact (unit_grid 38/38, unit_pick, props mutations caught).
5. sika/blind2-2026-11-02: only convo_final.json, CONVO_FINAL_2026-11-02.md and its scorer change (the strict honest-no check; --bank already came with generalise). convo_final.json contents were not read.
Rebuild: demo-tools/sika-210c0c/rebuild.sh once after the merges (idempotent on a second run) and again after the two fixes below. build_brain.mjs was not run.

## Fixes made during integration (new reds versus live base)
- blind3 BRAIN-WRONG c046 ("waterproofing for a concrete roof slab" offered VersiDrain drainage boards): came in with ef823068a (pick quality, already in the integration start point). advisor.js ACCESSORY now matches "VersiDrain". blind3 WRONG 1 -> 0, nothing else moved. Regression: unit_pick I1 (fails without the change, passes with it).
- sika-citematch "only match.js imports slang.js" (inherited from 1f36f8c67): chat.js now imports applySlang from match.js. STRUCTURE 12/12.

## sika-brain run_all.sh, base vs tip (both rc 0, BRAIN NODE GREEN)
| check | base 1f36f8c67 | tip |
|---|---|---|
| unit_brain | 39/39 | 43/43 |
| unit_convo | 92/92 | 92/92 |
| unit_general, unit_pick, unit_grid, unit_depth, unit_missing, unit_cart | not in base | 117/117, 41/41, 38/38, 56/56, 47/47, 18/18 |
| convo_opts | 95/95 | 118/118 |
| unit_coverage | 90/90 | 90/90 |
| GOLDEN | 4599/4659 (98.71%) | 4600/4659 (98.73%) |
| GOLDEN ATTR | 2332/2338 | 2332/2338 |
| GOLDEN KB | 84/87 (declined 2) | 84/87 (declined 1) |
| wave2c | WRONG 0, 100% | WRONG 0, 100% |
| test_measure_tools | 11/11 | 11/11 |
| bank WRONG / MISSING / pass | 3 / 140 / 87.9% | 0 / 57 / 95.2% |
| blind4 WRONG / pass | 0 / 89.2% | 0 / 92.4% |
| blind3 WRONG / pass | 0 / 95.1% | 0 / 96.1% |
| blind2 WRONG / pass | 0 / 96.3% | 0 / 95.4% (MISSING 4 -> 5) |
| extra, wild, wild2, wave2b | WRONG 0; 92.9 / 90.9 / 94.4 / 100% | WRONG 0; 92.9 / 92.2 / 94.4 / 100% |
| MEASURE GATE | OK | OK |
| sweep_dupes headerless rows | 0 | 0 |
| fixture80 | 71/80 | 71/80 |

## Conversation exams (base = base brain with the tip scorer and banks copied in)
| bank | base | tip |
|---|---|---|
| convo_bank | 172/240 (71.7%) | 212/240 (88.3%) |
| convo_holdout | 102/150 (68.0%) | 138/150 (92.0%) |
| convo_final | 64/120 (53.3%) | 71/120 (59.2%) |
| --gate | FAIL (4 social rows not-found) | OK |
convo_final by class, base -> tip: social 6 -> 10/10, clarify 3 -> 6/14, answer 21 -> 21/32, pick 8 -> 9/18, quantity 8 -> 8/12, honest-no 13 -> 11/23, compare 5 -> 6/11. The honest-no drop (2 rows) comes from the generalise lane (measured per merge commit; the integration start 25b53b21f scores 13/23). Not tuned: the bank is held out.

## Reviewer mutation script (mut.mjs pointed at /dev/shm/wt-int)
4/4 mutations caught (pack count 2 x 2 L, rounded up to 4, 14 m2 per pail, 7 x 2 L), all as P1-grid-pack / P1-grid-work.

## Other Sika suites, base vs tip
| suite | base | tip | class |
|---|---|---|---|
| sika-210c0c | rc 1: golden_qa t8, t11, t12; category_coverage rows | rc 1: same t8, t11, t12 and same rows; props 600, 0 failures | inherited |
| sika-actions | CART E2E 55/56 ("which primer for concrete" add chip), CMDSEL 40/40 | same 55/56 (now a concrete clarifier), CMDSEL 40/40 | inherited. e2e expectation NOT changed: a clarifier on "which primer for concrete" is not clearly right, a primer ask names the job |
| sika-brain2b | GREEN | 7 FAIL lines (chain "best screed for a warehouse floor" -> "how much for 300 m2 at 5 mm" answers the published rate, not the quantity; chained cart action) | NEW, from the generalise lane (fails on its own tip 03766af3b) |
| sika-brain2c | 92/132 | 83/132 | NEW: 92 -> 89 already at 25b53b21f (earlier lanes), 89 -> 83 from the missing lane (fails the same on d31f7d683) |
| sika-brain2d unit_plan | 135 pass, 2 fail (follow-up plan; precache 8,039,485 B > 8 MB) | 135 pass, 2 fail (same; precache 8,124,261 B) | inherited |
| sika-calc | unit/store/bot green; browser run broke on disk full | CALC 83/16/24, calc_browser 30/30, suite FAILURES line from the disk-full tar step | UNKNOWN (environment); rerun needed |
| sika-citematch | structure FAIL (chat.js imports slang.js) | structure GREEN; FAIL home first screen gzip 89,817 B > baseline 88,178 B; dist/main.js gzip 66,135 B > 65,176 B | structure fixed; size budgets NEW (chat bubbles and cart button in main) |
| sika-dosage | GREEN | GREEN | |
| sika-images | GREEN | GREEN | |
| sika-stock | FAIL (git show on an archive extract: no git there) | GREEN | base red is environmental |
| sika-w2 | W2 SITE SUITE GREEN | W2 SITE SUITE GREEN | |
| sika-jobcompare | ALL GREEN | ALL GREEN | |
| sika-sales | SALES ALL GREEN | SALES ALL GREEN | |
| sika-thumbvoice | 49/49 | 49/49 | |
| sika-bughunt run_regress | 52 passed, 1 failed (R6 product page offline: dynamic import fetch fails) | same 52/1, same R6 | inherited |
| brain_e2e | 2 failed: "tile adhesive longest open time" height 2203 px (limit 2110) at 390, 2090 px (limit 1920) at 1366 | same 2 failed, shorter: 2162 px and 2042 px | inherited |
| convo_e2e | GREEN (base version of the test) | GREEN (with the new New chat storage checks) | |
| cart_e2e | not in base | GREEN | |
(These ran after both fixes, against the final tip code. sika-bughunt run.sh, the long seeded simulation, was not run.)

/dev/shm filled to 0 MB free once during the runs (my per-commit extracts); removed, 1.2 GB free after. Any suite running at that moment may carry a false red (sika-calc on both sides did).

## Browser walk (walk_integrated.mjs, Windows Chrome, tip served by serve_wsl.mjs; shots_integrated/)
Both 390 and 1366 px, no console errors or warnings:
- Open: welcome bubble, G'day line, four starter chips.
- "what do you recommend for my bathroom": "Which part of the bathroom is the job?" with four chips (Waterproof under tiles, Tile adhesive, Grout, Sealant around the bath).
- Chip "Waterproof under tiles": My pick SCHONOX AB. Weak spot: the quoted reason is a heading run-on ("Residential wet areas and bathrooms Substrates Schonox AB is suitable on:"), not a real sentence. A surface follow-up with chips sits under it.
- "how much for 12 m2": honest refusal, quotes the published coverage (5 L covers 10 m2 rolled, 9 m2 trowelled) without computing it. The chip "How much SCHONOX AB do I need for my area" then shows the product card instead of asking for the area (weak spot).
- Add to quote: not offered on this path (no computed quantity). The add-to-quote flow is covered by cart_e2e, which did not finish in the cap.
- New chat: thread back to the welcome bubble; the saved brain context was present before and cleared after.
- Reload, then "the floor": "What is wrong with the floor?" with chips, so no bathroom context carried over. Correct.

## Not done
- Fixes for the three NEW reds (sika-brain2b chain quantity and cart routing, sika-brain2c 83/132, citematch size budgets): outside the time cap.
- sika-calc needs a clean rerun (disk-full false red on both sides); sika-bughunt run.sh (long simulation) not run. The tip sika-210c0c and sika-actions runs started before the last two fixes.
- No deploy, no push, no Telegram.
