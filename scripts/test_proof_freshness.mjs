// Freshness gate for the Proof Wall data. Fails when a proof.json row (chart or star) or a claims-ledger row has no system or no
// ISO measured-at date, or when that date is more than 30 days old. A stale number must be re-measured or marked UNKNOWN, never carried.
// PROOF_TODAY=YYYY-MM-DD overrides "today" (used by the mutation checks below and by CI replays).
// When the kernel ledger is readable here, the fleet row is also re-derived from it and must match (skipped, and said so, otherwise).
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";

const root = new URL("../", import.meta.url);
const J = (p) => JSON.parse(readFileSync(new URL(p, root), "utf8"));
const MAX_DAYS = 30;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };

export function problems(rows, today) {
  const out = [];
  for (const r of rows) {
    const where = r.id ?? "(no id)";
    if (!r.system || !String(r.system).trim()) out.push(`${where}: no system`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date || "")) { out.push(`${where}: no ISO date`); continue; }
    const age = (Date.parse(today) - Date.parse(r.date)) / 86400000;
    if (!(age <= MAX_DAYS)) out.push(`${where}: measured ${r.date}, ${Math.floor(age)} days old (limit ${MAX_DAYS})`);
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

  const pr = problems(rows, today);
  ok(pr.length === 0, `every proof.json row (${rows.length}) has a system and a date within ${MAX_DAYS} days of ${today}` + (pr.length ? " :: " + pr.join(" | ") : ""));
  const cr = problems(claims.rows, today);
  ok(cr.length === 0, `every claims-ledger row (${claims.rows.length}) has a system and a date within ${MAX_DAYS} days of ${today}` + (cr.length ? " :: " + cr.join(" | ") : ""));

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
