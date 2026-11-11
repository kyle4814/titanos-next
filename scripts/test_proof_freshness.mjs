// Freshness gate for the Proof Wall data. Fails when a proof.json row (chart or star) or a claims-ledger row has no system or no
// ISO measured-at date, or when that date is more than 30 days old. A stale number must be re-measured or marked UNKNOWN, never carried.
// Calendar drift does not fail the gate: a row older than MAX_DAYS is rendered as UNKNOWN (last measured <date>) by markStale
// (lib/site-data/markStale.mjs, wired into lib/site-data/proofLive.ts). The gate fails if such a row is rendered with a numeric value.
// PROOF_TODAY=YYYY-MM-DD overrides "today" (used by the mutation checks below and by CI replays).
// When the kernel ledger is readable here, the fleet row is also re-derived from it and must match (skipped, and said so, otherwise).
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { markStale, numericLeaks, MAX_DAYS as MARK_MAX } from "../lib/site-data/markStale.mjs";

const root = new URL("../", import.meta.url);
const J = (p) => JSON.parse(readFileSync(new URL(p, root), "utf8"));
const MAX_DAYS = 30;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };

export function problems(rows, today, maxDays = MAX_DAYS) {
  const out = [];
  for (const r of rows) {
    const where = r.id ?? "(no id)";
    if (!r.system || !String(r.system).trim()) out.push(`${where}: no system`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date || "")) { out.push(`${where}: no ISO date`); continue; }
    const age = (Date.parse(today) - Date.parse(r.date)) / 86400000;
    if (!(age <= maxDays)) out.push(`${where}: measured ${r.date}, ${Math.floor(age)} days old (limit ${maxDays})`);
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith("test_proof_freshness.mjs")) {
  const today = process.env.PROOF_TODAY || new Date().toISOString().slice(0, 10);
  const proof = J("lib/site-data/proof.json"), claims = J("public/data/claims-ledger.json");
  const rows = [...proof.charts, ...proof.stars];

  // mutation checks: the detector must trip on each defect
  ok(problems([{ id: "x", date: "2026-11-01" }], "2026-11-06").some((p) => p.includes("no system")), "detector trips on a row with no system");
  ok(problems([{ id: "x", system: "s" }], "2026-11-06").some((p) => p.includes("no ISO date")), "detector trips on a row with no date");
  ok(problems([{ id: "x", system: "s", date: "2026-09-01" }], "2026-11-06").some((p) => p.includes("days old")), "detector trips on a row over 30 days old");
  ok(problems([{ id: "x", system: "s", date: "2026-10-07" }], "2026-11-06").length === 0, "detector passes a row exactly 30 days old");

  // markStale unit checks (fixed clock)
  const sample = [{ id: "old", system: "s", date: "2026-09-01", display: "9 GB", before: 1, after: 2, beforePct: 100, afterPct: 50, caption: "c" }, { id: "new", system: "s", date: "2026-11-05", display: "7 GB" }];
  const marked = markStale(sample, "2026-11-06", MAX_DAYS);
  ok(marked.length === 2 && marked[0].display === "UNKNOWN" && marked[0].value === "UNKNOWN" && marked[0].lastMeasured === "2026-09-01" && /days old/.test(marked[0].staleReason) && marked[0].before === null && marked[0].id === "old", "markStale rewrites a 31+ day row to UNKNOWN, keeps the row, id and lastMeasured, invents no figure");
  ok(marked[1] === sample[1] && sample[0].display === "9 GB", "markStale leaves a fresh row untouched and does not mutate its input");
  ok(markStale([{ id: "x", system: "s", date: "2026-10-07", display: "1" }], "2026-11-06", 30)[0].display === "1", "markStale keeps a row exactly 30 days old");
  ok(MARK_MAX === 30 && MAX_DAYS === 30, "MAX_DAYS is still 30");

  // live data: structure must be sound (system + ISO date on every row); age is handled by markStale, not by failing the gate
  const structural = (rs) => problems(rs, today, Infinity);
  const spr = structural(rows), scr = structural(claims.rows);
  ok(spr.length === 0, `every proof.json row (${rows.length}) has a system and an ISO date` + (spr.length ? " :: " + spr.join(" | ") : ""));
  ok(scr.length === 0, `every claims-ledger row (${claims.rows.length}) has a system and an ISO date` + (scr.length ? " :: " + scr.join(" | ") : ""));

  // rendered output: no row older than MAX_DAYS carries a numeric value after markStale (the render path in proofLive.ts)
  const render = (rs) => markStale(rs, today, MAX_DAYS);
  const lp = numericLeaks(render(rows), today, MAX_DAYS), lc = numericLeaks(render(claims.rows), today, MAX_DAYS);
  ok(lp.length === 0, `no proof.json row older than ${MAX_DAYS} days is rendered with a numeric value on ${today}` + (lp.length ? " :: " + lp.join(" | ") : ""));
  ok(lc.length === 0, `no claims-ledger row older than ${MAX_DAYS} days is rendered with a numeric value on ${today}` + (lc.length ? " :: " + lc.join(" | ") : ""));
  ok(render(rows).length === rows.length && render(claims.rows).length === claims.rows.length, "markStale never deletes a row");

  // mutation: bypassing markStale must turn the gate red (when any row is stale today)
  const staleNow = problems(rows, today).length + problems(claims.rows, today).length;
  const bypass = (rs) => rs;
  const mutLeaks = numericLeaks(bypass(rows), today, MAX_DAYS).length + numericLeaks(bypass(claims.rows), today, MAX_DAYS).length;
  ok(numericLeaks(bypass(sample), "2026-11-06", MAX_DAYS).length === 1, "mutation: with markStale bypassed the fixed-clock sample leaks a numeric value, so the check is red");
  ok(staleNow === 0 || mutLeaks > 0, `mutation: with markStale bypassed the live data goes red (${mutLeaks} leaking rows)`);
  // the real render path must call markStale: a copy of proofLive.ts without the calls fails the same source check
  const wired = (src) => /markStale\(live\.stars/.test(src) && /markStale\(live\.charts/.test(src) && /from "\.\/markStale\.mjs"/.test(src);
  const live = readFileSync(new URL("lib/site-data/proofLive.ts", root), "utf8");
  ok(wired(live), "proofLive.ts renders stars and charts through markStale");
  ok(!wired(live.replace(/markStale\(live\.stars, TODAY\)/g, "live.stars")), "mutation: removing the markStale call from proofLive.ts is caught");

  // report: staleness stays visible
  const unk = render(rows).filter((r) => r.value === "UNKNOWN"), unkC = render(claims.rows).filter((r) => r.value === "UNKNOWN");
  console.log(`REPORT ${unk.length} of ${rows.length} proof.json rows and ${unkC.length} of ${claims.rows.length} claims-ledger rows now render UNKNOWN (older than ${MAX_DAYS} days on ${today}); re-measure queue: ${[...new Set([...unk, ...unkC].map((r) => `${r.id}@${r.lastMeasured}`))].join(", ") || "none"}`);

  // the fleet row reproduces from the ledger
  const snap = J("lib/site-data/source/FLEET_LEDGER_2026-10-12.json");
  const star = (id) => proof.stars.find((s) => s.id === id);
  ok(star("s_jobs").date === snap.measuredAt && star("s_jobs").display.startsWith(String(snap.jobsPerHour)), "s_jobs equals the fleet snapshot (value and date)");
  ok(star("s_fail").caption.includes(`${snap.failRatePct}%`), "s_fail equals the fleet snapshot");
  ok(/UNKNOWN/.test(star("s_jobs").method), "s_jobs method states the live reading is UNKNOWN while the ledger is not writing");
  const ledger = `${homedir()}/klinge-kernel/state/fleet/ledger.jsonl`;
  if (existsSync(ledger)) {
    const m = spawnSync("node", ["scripts/measure_fleet_ledger.mjs", "--day", snap.measuredAt, "--ledger", ledger], { cwd: root.pathname, encoding: "utf8" });
    const live = m.status === 0 ? JSON.parse(m.stdout) : null;
    ok(live && live.counts.finished === snap.counts.finished && live.jobsPerHour === snap.jobsPerHour && live.failRatePct === snap.failRatePct, "fleet row re-derived from the live ledger matches the snapshot");
  } else console.log("SKIP ledger not readable here, reproduction check not run");
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
