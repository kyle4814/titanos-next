#!/usr/bin/env node
// soak_restart_consumer.mjs - CONSUMER of the soak restart marker (f424, C10, 2026-11-11).
// f412 scripts/soak_pin_wire.mjs writes state/soak/RESTART.json when a tick fails or a merge lands during a soak. This reads it.
//   node scripts/soak_restart_consumer.mjs --dir state/soak [--max-age-hours 24] [--now ISO]
// Files under --dir (all local, fixture-friendly): RESTART.json (marker), PIN.json ({"sha": 40-hex}, the NEW pin), CLOCK.json (soak clock record),
//   RERUN_REQUEST.json (the x3 re-run request), archive/ (consumed markers).
// Consume = (a) reset the soak clock to the new pin, (b) write the x3 re-run request for that pin, (c) archive the marker so it fires once.
// Fail closed: corrupt / short-sha / stale / unreadable-pin / pin-not-advanced => exit 1, NOTHING written, marker left in place.
// No marker => exit 0 NOOP. Pure core (consume, validateMarker, x3Counts) plus a thin CLI. No network, no timers, no child processes.
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export const X3 = 3;
export const SHA40 = /^[0-9a-f]{40}$/;
export const DEFAULT_MAX_AGE_MS = 24 * 3600 * 1000;
export const FUTURE_SKEW_MS = 5 * 60 * 1000;

export const digestOf = (raw) => createHash("sha256").update(raw).digest("hex");

// Pure. raw = marker file text. -> {ok:true, marker} | {ok:false, error}
export function validateMarker(raw, { now, maxAgeMs = DEFAULT_MAX_AGE_MS } = {}) {
  let m;
  try { m = JSON.parse(raw); } catch { return { ok: false, error: "marker is not valid JSON" }; }
  if (!m || typeof m !== "object" || Array.isArray(m)) return { ok: false, error: "marker is not an object" };
  if (m.restart !== true) return { ok: false, error: "marker.restart is not true" };
  if (typeof m.reason !== "string" || !m.reason.trim()) return { ok: false, error: "marker.reason missing" };
  if (typeof m.at !== "string" || Number.isNaN(Date.parse(m.at))) return { ok: false, error: "marker.at missing or not a date" };
  if (m.pinned !== undefined && !(typeof m.pinned === "string" && SHA40.test(m.pinned)))
    return { ok: false, error: "marker.pinned is not a 40-hex sha (short or malformed sha rejected)" };
  const age = now - Date.parse(m.at);
  if (age > maxAgeMs) return { ok: false, error: `marker is stale (${Math.round(age / 3600000)} h old, max ${Math.round(maxAgeMs / 3600000)} h)` };
  if (age < -FUTURE_SKEW_MS) return { ok: false, error: "marker.at is in the future" };
  return { ok: true, marker: m };
}

// Pure. Builds the clock record and the re-run request. -> {ok, clock, request} | {ok:false, error}
export function plan({ raw, pinSha, prevClock, now, maxAgeMs }) {
  const v = validateMarker(raw, { now, maxAgeMs });
  if (!v.ok) return v;
  const m = v.marker;
  if (typeof pinSha !== "string" || !SHA40.test(pinSha)) return { ok: false, error: "new pin sha missing or not 40-hex (short sha rejected)" };
  if (m.pinned && m.pinned === pinSha) return { ok: false, error: "pin not advanced: PIN.json still equals the pre-restart pinned sha, x3 would run on the old build" };
  const digest = digestOf(raw);
  const iso = new Date(now).toISOString();
  const clock = {
    pin_sha: pinSha, started_at: iso, elapsed_ms: 0, restarts: (prevClock && Number.isInteger(prevClock.restarts) ? prevClock.restarts : 0) + 1,
    last_marker_digest: digest, last_reason: m.reason, last_stage: m.stage || null, previous_pin_sha: m.pinned || (prevClock && prevClock.pin_sha) || null,
  };
  const request = {
    version: 1, marker_digest: digest, sha: pinSha, created_at: iso, reason: m.reason, stage: m.stage || null,
    rule: "x3 independent escape probes must each pass with 0 open P0/P1 on exactly this sha; a pass on any other sha does not count",
    required_probes: Array.from({ length: X3 }, (_, i) => ({ id: `x3-${i + 1}`, sha: pinSha })),
  };
  return { ok: true, clock, request, digest };
}

// Pure. Does the evidence satisfy the request? Only results on request.sha count; one vote per probe id.
// results: [{probe_id, sha, pass, open_p0, open_p1}]
export function x3Counts(request, results) {
  if (!request || !SHA40.test(request.sha || "") || !Array.isArray(request.required_probes)) return { ok: false, passed: 0, stale: 0, need: X3 };
  const want = new Set(request.required_probes.map((p) => p.id));
  const seen = new Set();
  let stale = 0;
  for (const r of Array.isArray(results) ? results : []) {
    if (!r || typeof r !== "object") continue;
    if (r.sha !== request.sha) { stale++; continue; }
    if (r.pass === true && r.open_p0 === 0 && r.open_p1 === 0 && want.has(r.probe_id)) seen.add(r.probe_id);
  }
  return { ok: seen.size === want.size && want.size === X3, passed: seen.size, stale, need: want.size };
}

const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return undefined; } };
const writeAtomic = (p, obj) => { const t = p + ".tmp"; writeFileSync(t, JSON.stringify(obj, null, 2) + "\n"); renameSync(t, p); };

// Effectful wrapper over a directory. -> {code, line}
export function consume({ dir, now = Date.now(), maxAgeMs = DEFAULT_MAX_AGE_MS }) {
  const markerPath = join(dir, "RESTART.json");
  if (!existsSync(markerPath)) return { code: 0, line: "SOAKRST NOOP no restart marker" };
  let raw;
  try { raw = readFileSync(markerPath, "utf8"); } catch { return { code: 1, line: "SOAKRST FAIL marker unreadable" }; }
  const pin = readJson(join(dir, "PIN.json"));
  const prevClock = readJson(join(dir, "CLOCK.json"));
  const p = plan({ raw, pinSha: pin && pin.sha, prevClock, now, maxAgeMs });
  if (!p.ok) return { code: 1, line: `SOAKRST FAIL ${p.error}` };
  // Crash-safe replay: a prior run that wrote the clock but died before archiving must not reset the clock a second time.
  const replay = prevClock && prevClock.last_marker_digest === p.digest;
  if (!replay) {
    writeAtomic(join(dir, "RERUN_REQUEST.json"), p.request);
    writeAtomic(join(dir, "CLOCK.json"), p.clock);
  }
  const arch = join(dir, "archive");
  mkdirSync(arch, { recursive: true });
  renameSync(markerPath, join(arch, `RESTART.${p.digest.slice(0, 12)}.json`));
  return { code: 0, line: `SOAKRST OK consumed, clock reset on ${p.request.sha.slice(0, 9)}, x3 re-run requested${replay ? " (replay, clock already reset)" : ""}` };
}

function parse(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) a[argv[i].slice(2)] = argv[++i];
  return a;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = parse(process.argv.slice(2));
  if (!a.dir) { console.log("SOAKRST FAIL usage: --dir <soak dir> [--max-age-hours N] [--now ISO]"); process.exit(1); }
  const now = a.now ? Date.parse(a.now) : Date.now();
  const maxAgeMs = a["max-age-hours"] ? Number(a["max-age-hours"]) * 3600000 : DEFAULT_MAX_AGE_MS;
  if (Number.isNaN(now) || !(maxAgeMs > 0)) { console.log("SOAKRST FAIL bad --now or --max-age-hours"); process.exit(1); }
  const r = consume({ dir: a.dir, now, maxAgeMs });
  console.log(r.line);
  process.exit(r.code);
}
