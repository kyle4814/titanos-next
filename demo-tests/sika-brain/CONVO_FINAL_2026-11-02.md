# CONVO FINAL 2026-11-02: the final blind exam (keep unseen)

Bank: demo-tests/sika-brain/convo_final.json. 120 rows: 90 single messages plus 30 multi-turn scripts (2 to 3 turns). Personas: painter, pool builder, strata manager, farmer fixing a shed, plumber, apprentice on day one, Sika rep demoing to a store. Written blind of every other bank. Not wired into run_all.sh: run by hand, and only for a final score.

Run: `node demo-tests/sika-brain/convo_score.mjs --bank convo_final.json` (add `--md` for more failure detail, `--json out.json` for rows). Report-only, exit 0. No model, no network.

Honest-no rows carry `strict`: the final card must say the answer is not in the published documentation (or be the unknown card) and must not carry any product card or name a Sika or Davco product.

## Baseline on 2e8900c64 (unchanged brain): 65/120 rows pass (54.2%)

By class:
- social 6/10 (60.0%)
- clarify 3/14 (21.4%)
- pick 9/18 (50.0%)
- answer 21/32 (65.6%)
- honest-no 13/23 (56.5%)
- compare 5/11 (45.5%)
- quantity 8/12 (66.7%)

By persona: painter 10/16, pool 9/17, strata 11/16, farmer 8/17, plumber 11/18, apprentice 8/17, rep 8/19.

No example transcripts are recorded here on purpose. Do not tune the brain to these rows; use them to measure once.
