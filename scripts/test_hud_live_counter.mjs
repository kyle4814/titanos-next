// Live counter gate: validation, never-backwards re-anchor, pace-driven tick, bounded run-ahead, pulse, component wiring.
import { readFileSync } from "node:fs";
import { validateNumbers, reanchor, eyAt, pulse, livePace, REFRESH_MS, KEYS } from "../lib/hud/live.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const R = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const good = { v: 1, generated_ms: 1_791_543_027_316, sloc: 235017, repos: 12, ey: 61.75672, ey_per_day_1h: 0.8873, ey_per_day_24h: 1.49,
  ey_per_day_7d: 2.25, aud_per_ey: 521541.95, jobs_1h: 12, jobs_24h: 1399, jobs_per_hr_avg: 40.03, commits_1h: 6 };
const DAY = 86_400_000;

ok(validateNumbers(good)?.ey === good.ey, "a good measurement validates");
ok(validateNumbers(null) === null && validateNumbers([]) === null && validateNumbers("x") === null, "non-objects rejected");
ok(validateNumbers({ ...good, path: "/home/x" }) === null, "an extra key is rejected");
{ const g = { ...good }; delete g.jobs_1h; ok(validateNumbers(g) === null, "a missing key is rejected"); }
ok(validateNumbers({ ...good, ey: -1 }) === null && validateNumbers({ ...good, ey: NaN }) === null && validateNumbers({ ...good, ey: "61" }) === null, "negative, NaN and string values rejected");
ok(validateNumbers({ ...good, ey: 0 }) === null && validateNumbers({ ...good, v: 2 }) === null, "zero ey and a wrong version rejected");
ok(KEYS.length === 13, "13 allow-listed keys");

const t0 = 1_791_543_100_000;
const a = reanchor(0, good, t0);
ok(a.ey === good.ey, "first anchor = the measured value");
ok(Math.abs(eyAt(a, t0 + 30_000) - (good.ey + (good.ey_per_day_1h * 30_000) / DAY)) < 1e-12, "between fetches it ticks at the live 1 h pace");
const busy = reanchor(0, { ...good, ey_per_day_1h: 4 }, t0), quiet = reanchor(0, { ...good, ey_per_day_1h: 0.1 }, t0);
ok(eyAt(busy, t0 + 60_000) - busy.ey > 10 * (eyAt(quiet, t0 + 60_000) - quiet.ey), "a busy fleet visibly speeds the counter up, a quiet one slows it");
ok(eyAt(reanchor(0, { ...good, ey_per_day_1h: 0 }, t0), t0 + 60_000) === good.ey, "pace 0: the counter holds, no invented growth");
// never backwards: shown is ahead of a fresh (lower) measurement -> keep shown
const shown = eyAt(a, t0 + 60_000);
const b = reanchor(shown, { ...good, ey: good.ey + 0.00001 }, t0 + 60_000);
ok(b.ey === shown, "re-anchor keeps max(shown, measured): never jumps back");
ok(reanchor(shown, { ...good, ey: good.ey + 5 }, t0 + 60_000).ey === good.ey + 5, "a higher measurement lifts the counter to it");
// bounded run-ahead: a dead feed cannot run the counter away
const far = eyAt(a, t0 + 400 * DAY);
ok(far <= good.ey + (good.ey_per_day_1h * 2 * REFRESH_MS) / DAY + 1e-12, "with no new measurement it stops at two refresh intervals ahead");
ok(eyAt(a, t0 - 5000) === good.ey, "a clock behind the anchor never goes below it");
ok(livePace({ ...good, ey_per_day_1h: NaN }) === good.ey_per_day_24h, "a missing 1 h pace falls back to the 24 h pace");

const p = pulse(good, good.generated_ms + 5 * 60_000);
ok(p.jobs1h === 12 && p.ageMin === 5 && !p.stale, "pulse: jobs this hour, age in minutes");
ok(Math.abs(p.ratio - 0.8873 / 2.25) < 1e-9, "pulse: pace now vs 7-day average ratio");
ok(pulse(good, good.generated_ms + 4 * 3_600_000).stale === true, "a measurement over 3 h old is stale");
ok(pulse({ ...good, ey_per_day_7d: 0 }, good.generated_ms).ratio === null, "ratio is null when the 7-day average is 0");

const src = R("components/hud/EngineeringCounter.tsx");
ok(/\/hud\/numbers\.json\?ts=\$\{Date\.now\(\)\}/.test(src) && /cache: "no-store"/.test(src), "fetches /hud/numbers.json with a cache-buster and no-store");
ok(/\bpull\(\);/.test(src.slice(src.indexOf("const pull"))) && /setInterval\(pull, REFRESH_MS\)/.test(src), "fetches on open, then every REFRESH_MS");
ok(REFRESH_MS === 60_000, "refresh is 60 s");
ok(/document\.hidden/.test(src) && /clearInterval\(poll\)/.test(src), "pauses when the tab is hidden; timers cleared on unmount");
ok(/reanchor\(shown, m, t\)/.test(src) && /validateNumbers/.test(src) && /catch \{\}/.test(src), "re-anchors only on a validated measurement; failure keeps the anchor");
ok(!/MAX_EXTRAPOLATE_DAYS/.test(src) && !/MAX_EXTRAPOLATE_DAYS/.test(R("lib/hud/data.ts")), "the 14-day live cap is gone");
ok(/MODELLED/.test(src) && /MODELLED: COCOMO, method/.test(src) && /not revenue and not a bank balance/.test(src), "MODELLED tag, method link and not-revenue note stay");
ok(/data-testid="hud-pulse"/.test(src) && /Fleet pulse/.test(src), "fleet pulse readout is rendered");
ok(/prefers-reduced-motion/.test(src), "reduced motion stops the 100 ms tick");
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
