# Soak memory-growth row S16 and what still needs a real 24 h run (2026-11-07)

Supersedes the "no row yet: memory/store growth" line in docs/soak/f195_pending_live.md. Harness: scripts/soak_harness.mjs (board rows still PROPOSED, now 16). TESTED only; not INDEPENDENTLY VERIFIED, not LIVE, not deployed. Loopback only, synthetic.

## S16 as built
- Sampler: at every sample window the runner records `{t, heapUsed, rss}` into `mem_series` in the board JSON. Self mode forces a GC first (v8 `--expose_gc` set at runtime, no CLI flag) and records `heapUsed + external`, so the series is RETAINED memory, not allocator noise. `memPid` (CLI `--mem-pid <pid>`) reads `VmRSS` of another process from /proc instead.
- Row: S16 = least-squares slope in bytes per second over the samples after a 25% warm-up (`MEM_WARMUP_FRAC`). Green when `<= 131072` (128 KiB/s, `DEFAULT_THRESHOLDS.S16`; override with `--thresholds '{"S16":...}'`).
- Fail closed: fewer than 4 post-warm-up samples, or no series, is BLIND and the row is RED (value null in the JSON).
- Measured on this box (load about 22): clean in-process handler 16 to 36 KiB/s over 6 to 20 s runs (settling, flattening: a 20 s run plateaued near 11.5 MB); the test leaking handler (4 KiB retained per request) is far over the threshold.

## Tests (scripts/test_soak_harness.mjs, now 16 checks)
- Board maths: flat, 0.9x and 1.1x of the threshold, 10x, warm-up ramp ignored, no series, too few points.
- Live loopback, 6 s each: leaking handler FAILS S16 (RED, slope more than 4x the threshold, board not green); clean handler PASSES S16 and the whole board is GREEN.
- Mutations, each caught: comparison operator flipped, threshold loosened to 999999999, threshold tightened to 1, blind run passing instead of failing, warm-up fraction set to 0.

## PENDING LIVE (needs a real 24 h run, or real dependencies)
Everything in docs/soak/f195_pending_live.md still applies, plus for S16:
- The default 128 KiB/s is a SHORT-RUN guard. Over 24 h it would allow about 10.6 GB, so it is not a leak verdict. The 24 h run needs a baseline-derived value (for example 1 KiB/s, about 84 MB/day) and Kyle's call on it.
- Self mode only sees targets served in this process (stub, test handler, serve-out). The real portal runs in another process: the 24 h run must pass `--mem-pid` for each server (next, portal-api, the Worker equivalent), and RSS includes allocator slack, so its threshold differs from the heap one.
- A real leak can be slow (kilobytes per hour) and shaped by caches that fill then plateau; only hours of series, with the day boundary in it, can separate the two. The 25% warm-up is a guess for a 24 h run (6 h may be right).
- Store growth outside the process (D1 rows, KV keys, log files) is not in S16 at all.
- Still no row for the mounted guest scan and concierge routes (f81 finding 2); this chunk did not add one.

## Observed, not fixed (out of scope, backlog)
The runner's trailing partial window (`if (win.n) sample()` after stop) can hold only a few in-flight delayed requests, so its p95 spikes (about 150 ms with delayMs 150) and the old 20 s test's S13 drift row can go RED (seen 1 of 3 full test runs on a busy box; the baseline passed 3 of 3). Dropping a final window shorter than half an interval from S13 would fix it.
