#!/usr/bin/env node
// C1 kill test as pure code (plan ch.6, C1): at least 3% of the first 1,000 guest scans press GET THIS FIXED.
// Usage: node scripts/funnel_killtest.mjs [events.ndjson]   (no argument = stdin). No network, no model calls.
//
// Event shape = the shape the site already fires (components/SiteAnalytics.tsx sends {event, path}; names from
// components/GuestScan.tsx data-analytics, same constants as portal-api counters/store.ts):
//   scan:  event "scan-instant-run"   press: event "scan-get-fixed"
// Added keys the tally needs (the beacon carries none of them today; WOULD-FLIP to live = beacon sends scanId):
//   scanId (string)  ties a press to its scan; ts (epoch ms number or ISO string); bot (true) if the counter reader flags it.
// Rules: a press counts once per scan id; repeats = duplicatePresses; press with no matching scan (or no scanId) =
// orphanPresses; bot-flagged events are excluded and counted; unparseable lines are counted in malformed, never throw.
// Verdict: PENDING_LIVE below 1,000 scans, else integer maths on the first 1,000 scans (presses*100 >= 3*1000).
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const EVENT_SCAN = "scan-instant-run";
export const EVENT_GET_FIXED = "scan-get-fixed";
export const KILL_TEST_SCANS = 1000;
export const KILL_TEST_MIN_PERCENT = 3;

function parseTs(v) {
  if (v === undefined || v === null) return { ok: true, ts: null };
  if (typeof v === "number") return Number.isFinite(v) ? { ok: true, ts: v } : { ok: false };
  if (typeof v === "string") { const t = Date.parse(v); return Number.isNaN(t) ? { ok: false } : { ok: true, ts: t }; }
  return { ok: false };
}

export function funnelKillTest(input) {
  const lines = Array.isArray(input) ? input : String(input ?? "").split(/\r?\n/);
  const c = { malformed: 0, ignoredOther: 0, botExcluded: 0, duplicateScans: 0, duplicatePresses: 0, orphanPresses: 0, scansWithoutId: 0 };
  const scans = []; // {id|null, ts, i}
  const presses = []; // {id, ts, i}
  const seenScan = new Set(), botScan = new Set();
  let i = 0;
  for (const raw of lines) {
    i++;
    if (typeof raw !== "string" || raw.trim() === "") continue;
    let o;
    try { o = JSON.parse(raw); } catch { c.malformed++; continue; }
    if (o === null || typeof o !== "object" || Array.isArray(o) || typeof o.event !== "string") { c.malformed++; continue; }
    const t = parseTs(o.ts);
    const idOk = o.scanId === undefined || (typeof o.scanId === "string" && o.scanId !== "");
    if (!t.ok || !idOk || (o.bot !== undefined && typeof o.bot !== "boolean")) { c.malformed++; continue; }
    if (o.event !== EVENT_SCAN && o.event !== EVENT_GET_FIXED) { c.ignoredOther++; continue; }
    const id = o.scanId ?? null;
    if (o.bot === true) { c.botExcluded++; if (o.event === EVENT_SCAN && id) botScan.add(id); continue; }
    const rec = { id, ts: t.ts, i };
    if (o.event === EVENT_SCAN) {
      if (id === null) { c.scansWithoutId++; scans.push(rec); continue; }
      if (seenScan.has(id)) { c.duplicateScans++; continue; }
      seenScan.add(id); scans.push(rec);
    } else presses.push(rec);
  }
  // Order by timestamp (events without one sort last, then input order), so out-of-order delivery cannot change the window.
  const key = (r) => [r.ts ?? Infinity, r.i];
  const cmp = (a, b) => { const [x, y] = [key(a), key(b)]; return x[0] === y[0] ? x[1] - y[1] : x[0] < y[0] ? -1 : 1; };
  scans.sort(cmp);
  const first = scans.slice(0, KILL_TEST_SCANS);
  const firstIds = new Set(first.filter((s) => s.id).map((s) => s.id));
  const pressedAll = new Set(), pressedFirst = new Set();
  for (const p of presses) {
    if (!p.id || (!seenScan.has(p.id) && !botScan.has(p.id))) { c.orphanPresses++; continue; }
    if (botScan.has(p.id)) { c.botExcluded++; continue; }
    if (pressedAll.has(p.id)) { c.duplicatePresses++; continue; }
    pressedAll.add(p.id);
    if (firstIds.has(p.id)) pressedFirst.add(p.id);
  }
  const n = scans.length, m = pressedAll.size;
  const f = first.length, fm = pressedFirst.size;
  const r4 = (x) => Math.round(x * 10000) / 10000;
  const verdict = n < KILL_TEST_SCANS ? "PENDING_LIVE" : fm * 100 >= KILL_TEST_MIN_PERCENT * KILL_TEST_SCANS ? "PASS" : "FAIL";
  return {
    scans: n, presses: m, rate: n ? r4(m / n) : null,
    first1000_rate: f ? r4(fm / f) : null, first1000_scans: f, first1000_presses: fm,
    verdict, ...c,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const file = process.argv[2];
  let text;
  try { text = file ? readFileSync(file, "utf8") : readFileSync(0, "utf8"); } catch (e) { console.error(`cannot read input: ${e.message}`); process.exit(2); }
  console.log(JSON.stringify(funnelKillTest(text)));
}
