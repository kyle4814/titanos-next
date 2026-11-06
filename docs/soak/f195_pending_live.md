# Soak rows after the f195 quantise + S9 + S1 fixes (2026-11-07)

Harness: scripts/soak_harness.mjs (board rows still PROPOSED). Run: docs/soak/f195_portal_soak_board_180s.json (180 s, 10,767 requests, loopback, synthetic, light chaos profile, seed 1). TESTED only; not INDEPENDENTLY VERIFIED, not LIVE.

## What changed
- (a) Latency histogram: log-spaced buckets, ratio 1.01, 1 us to 10 s (error under 0.5%). Test: uniform(0.2,0.9) ms and lognormal(3 ms, 0.4) known distributions, 200k seeded samples, p50/p95 within 2% of the analytic value; 0.4 ms vs 0.6 ms resolved.
- (b) Chaos profile `bad_window` (seeded burst of 100% injected 5xx over 4 windows). Test: S9 = 4 RED, S2 RED on it; `clean` profile S9 = 0, whole board GREEN. Board-maths cases at 0/1/2/3/8 consecutive bad windows. Mutations (S9 threshold 2 to 99, bad-window cut 0.05 to 0.95, operator flipped) are each caught.
- (c) S1 default stays RAW (injected faults count against availability, so boards stay comparable with f81). The JSON now has `s1` (mode, treatment text, raw and organic values, injected vs organic error counts, breakdown) and `injected_vs_organic`. `--s1-mode organic` makes the S1 row exclude injected faults. Injected 5xx are marked by header x-soak-injected; drops are attributed from transport errors up to the proxy's own drop count.

## 3 minute run, what it says
S1 raw 0.9957, organic 1.0 (46 errors, all injected: 24 5xx, 22 drops; organic 0). 15/15 GREEN. S13 = 0.4329 (limit 1.5), per-quarter p95 means 13.99 / 8.52 / 7.16 / 6.20 ms: early windows are SLOWER (warm-up), so the f81 "step up" was not a leak signature here. Still not a leak verdict: 180 s, shared process, box busy.
S9 = 0 here is still "never exercised" on the live portal run: the exercise is the bad_window test, against the stub target.

## PENDING LIVE (needs a real 24 h run, or real dependencies)
S1 (real unfaulted traffic, Kyle's call: raw or organic), S2 (43,200 windows), S3-S5 (D1, Stripe test mode, real DoH, cold Workers; thresholds are Kyle's call), S6 (capacity, not offered load), S7 (sampler surviving restarts, writing to disk), S8 (daily caps and resets), S9 (recovery of the real portal after a real fault, not the stub), S10 (hung upstream), S11/S12 (real failure modes), S13 (forced-GC memory series over hours), S14 (a surface dying at hour 9), S15 (portal recovering from something hard). Plus no row yet: memory/store growth, day boundary, mounted routes for guest scan and concierge (f81 finding 2).
