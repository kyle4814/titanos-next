# Rows that a 10-minute run cannot judge (f81, 2026-11-07)

Board: scripts/soak_harness.mjs S1-S15 (all PROPOSED). Run: docs/soak/f81_portal_soak_board.json (580 s, 34,745 requests, 855 injected faults, loopback, synthetic).

| Row | 10 min result | Why it cannot be judged without a real 24 h run |
|---|---|---|
| S1 availability 0.9948 | GREEN | The 0.5% misses are the harness's own injected drops and 5xx (soak_harness faults), not the portal. A 24 h run needs real, unfaulted traffic and a decision on how much chaos counts against availability. |
| S2 worst window | GREEN | 290 windows of 2 s; 24 h gives 43,200 windows. Rare collapses (a GC pause, a deploy, a DoH outage) will not show in 290. |
| S3-S5 p50/p95/p99 | GREEN | In-process handlers over memory adapters: floor latency only. D1, Stripe, real DoH (up to 6 s timeout) and cold Worker starts are absent. Thresholds (200/800/2000 ms) are defaults; the C1 bar "under 10 s on a phone" is not measured here. Chaos delays (150 ms) are inside the percentiles. |
| S6 throughput | GREEN | Capped at 60 rps by choice; it proves delivery of the offered load, not capacity. |
| S7 sampler coverage | GREEN | Sampler health over 10 min only; a 24 h run needs a sampler that survives restarts and writes to disk as it goes. |
| S8 stalls | GREEN | A stall needs time to appear (timers, quotas, rate limits that reset daily). |
| S9 recovery | GREEN (0) | No window was bad enough (worst 3.4%, threshold bad > 5%) so recovery was never exercised. NOT JUDGED, not proven. |
| S10 timeouts | GREEN | 0 timeouts at a 3 s client timeout; no hung upstream exists in the memory adapters. |
| S11/S12 transport and 5xx | GREEN | Both are the injected chaos. Real portal 5xx = portal_threw 0 (per_target), but D1/Stripe failure modes are not simulated. |
| S13 latency drift 1.4891 | GREEN, marginal (limit 1.5) | The only row near its line. Per-quarter p95 means: 7.6, 10.5, 12.0, 11.3 ms: a step up between Q1 and Q2, then flat. Heap +5.9 MB, RSS +24 MB over 34.7k requests, no forced GC. Cannot tell warm-up, load from other lanes (box load ~11 of 8 cores) or a slow leak apart in 10 min; a 24 h run with a forced-GC memory series can. |
| S14 dead targets | GREEN | 4 of 4 reached; says nothing about a surface that dies at hour 9. |
| S15 chaos seen | GREEN | Shows the injector fired (855 faults); not that the portal recovered from anything hard. |

## Not covered at all (no row exists)
- Memory growth and store growth as a gated row (rough reading only here).
- Day-boundary behaviour: daily caps, key spend caps, rate-limit resets, cron sweeps, token expiry, receipt rotation.
- Real dependencies: D1, Stripe test mode, real DoH, Workers cold starts, CPU limits per request.
- Concierge ask and guest scan as HTTP routes: neither exists in portal-api (libraries only); a 24 h run needs the mounted route.
- Key-less MCP tools/list: the route returns 401 by design (probe in the board JSON), so only the key-bearing list and the public GET /agent/tools were loaded.

## Calls that need Kyle before a real run
Thresholds for S3-S5 and S13, whether chaos counts against S1, and 24 h vs 48 h (R-39, from the f11 receipt).
