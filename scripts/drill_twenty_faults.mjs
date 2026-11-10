#!/usr/bin/env node
// C3 kill test (plan ch.6 line 1491): 20 planted faults, each pushed through the owner seat end to end:
// scan (found) -> reversible auto-fix or guided refusal -> owner edit where needed -> re-scan (PROVEN_FIXED, badge)
// -> undo is exact -> fault re-planted -> monitor catches it, badge LOST, alert -> re-proven again.
// ALL data is SYNTHETIC (.example domains, in-memory MemoryZone + MemoryOwnerStore). No network, no model calls, no writes outside memory.
// Reports "N of 20" honestly; every failure is listed by class (check) and step, never hidden.
// Reuses: portal-api owner seat (w3), SPF guards (f20), nested walk (f35/f38), fault list (portal-api/test/owner_faults.ts).
import { pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const P = (p) => pathToFileURL(resolve(ROOT, "portal-api", p)).href;
const { rig } = await import(P("test/owner_harness.ts"));
const { FAULTS } = await import(P("test/owner_faults.ts"));
const { autoFix, undoFix, questsOf, monitorTick } = await import(P("src/owner/engine.ts"));

export const LABEL = "SYNTHETIC: 20 planted faults on .example domains, in-memory adapters, 2026-11-06";
const canon = (w) => JSON.stringify({ txt: Object.fromEntries(Object.entries(w.txt ?? {}).sort(([a], [b]) => (a < b ? -1 : 1))), mx: w.mx ?? null, ds: w.ds ?? null });

// opts.wrapZone(zone, fault) lets the self-test sabotage an adapter; it must return nothing (mutates in place).
export async function runOne(f, opts = {}) {
  const steps = []; const failures = [];
  const chk = (step, ok, detail = "") => { steps.push({ step, ok }); if (!ok) failures.push({ step, detail }); return ok; };
  try {
    const R = rig(); const s = await R.open();
    f.plant(R.zone, R.domain); R.monitorOn(s);
    opts.wrapZone?.(R.zone, f);
    await R.scan(s);
    // 1 FOUND
    chk("found", s.findings[f.check]?.state === "OPEN", `state ${s.findings[f.check]?.state}`);
    chk("quest", questsOf(s).open.some((q) => q.check === f.check));
    chk("no_badge_while_faulty", !s.badge || s.badge.level < 9, `badge ${s.badge?.level}`);
    const planted = canon(R.zone.world);
    // 2 FIX + 3 REVERSIBLE
    const ar = await autoFix(R.c, s, f.check);
    if (f.auto) {
      chk("autofix_applied", ar.ok === true, JSON.stringify(ar).slice(0, 160));
      if (ar.ok) {
        const fx = s.fixes.at(-1);
        const u = await undoFix(R.c, s, fx.id);
        chk("undo_ok", u.ok === true, JSON.stringify(u));
        chk("undo_exact", canon(R.zone.world) === planted, "zone after undo differs from the planted zone");
        chk("undo_reopens", s.findings[f.check]?.state !== "PROVEN_FIXED" && s.findings[f.check]?.status !== "PASS", `state ${s.findings[f.check]?.state}`);
        const ar2 = await autoFix(R.c, s, f.check);
        chk("autofix_reapplied", ar2.ok === true, JSON.stringify(ar2).slice(0, 160));
      }
    } else {
      chk("guided_refused", ar.ok === false && ar.reason === "guided", JSON.stringify(ar).slice(0, 160));
      chk("refusal_writes_nothing", R.zone.writes.length === 0 && canon(R.zone.world) === planted, `${R.zone.writes.length} writes`);
    }
    if (!f.auto || f.autoThenOwner || f.id.startsWith("20")) await f.ownerFix(R.zone, R.domain);
    R.clock.t += 1000; await R.scan(s, "owner re-scan");
    // re-proven end to end
    const keys = f.id.startsWith("20") ? ["SPF", "DMARC"] : [f.check];
    for (const k of keys) chk(`reproven_${k}`, s.findings[k]?.state === "PROVEN_FIXED" && s.findings[k]?.status === "PASS" && /^scn_\d+$/.test(s.findings[k]?.proof?.scanId ?? ""), `${k} ${s.findings[k]?.state}/${s.findings[k]?.status}`);
    chk("badge_earned", s.badge?.level === 9, `badge ${s.badge?.level}`);
    chk("no_open_quests", questsOf(s).open.length === 0, `${questsOf(s).open.length} open`);
    // 4 FAULT RETURNS: badge lost
    f.plant(R.zone, R.domain); R.clock.t = s.monitor.nextScanAt;
    const t = await monitorTick(R.c); const s2 = await R.c.store.get("dom_1");
    chk("monitor_scanned", t.scanned === 1, `scanned ${t.scanned}`);
    chk("regressed", s2.findings[f.check]?.state === "REGRESSED", `state ${s2.findings[f.check]?.state}`);
    chk("badge_lost", (s2.badge?.level ?? 0) < 9 && s2.events.some((e) => e.kind === "badge_lost") && t.alerts.some((a) => a.kind === "badge_lost"), `badge ${s2.badge?.level}, alerts ${t.alerts.map((a) => a.kind)}`);
    // 5 re-proven again
    await f.ownerFix(R.zone, R.domain); R.clock.t += 1000;
    await R.c.store.put(s2); const s3 = await R.open(); await R.scan(s3, "second owner re-scan");
    for (const k of keys) chk(`reproven_again_${k}`, s3.findings[k]?.state === "PROVEN_FIXED", `${k} ${s3.findings[k]?.state}`);
    chk("badge_back", s3.badge?.level === 9, `badge ${s3.badge?.level}`);
  } catch (e) { failures.push({ step: "exception", detail: String(e?.message ?? e).slice(0, 200) }); }
  return { id: f.id, check: f.check, auto: f.auto, steps, ok: failures.length === 0, failures };
}
export async function runDrill(opts = {}) {
  const results = []; for (const f of FAULTS) results.push(await runOne(f, opts));
  const passed = results.filter((r) => r.ok).length;
  const failedByClass = {};
  for (const r of results.filter((x) => !x.ok)) (failedByClass[r.check] ??= []).push({ id: r.id, failures: r.failures });
  return { label: LABEL, total: FAULTS.length, passed, line: `${passed} of ${FAULTS.length} planted faults found, fixed, re-proven, reversible, badge lost on return`, classes: [...new Set(FAULTS.map((f) => f.check))], failedByClass, results };
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const d = await runDrill();
  if (process.argv.includes("--json")) console.log(JSON.stringify(d, null, 1));
  else {
    console.log(`# ${d.label}`);
    for (const r of d.results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.id} [${r.check}${r.auto ? ", auto" : ", guided"}] ${r.steps.length} checks${r.ok ? "" : ": " + r.failures.map((x) => `${x.step} (${x.detail})`).join("; ")}`);
    console.log(d.line);
    for (const [c, l] of Object.entries(d.failedByClass)) console.log(`FAILED CLASS ${c}: ${l.map((x) => x.id).join(", ")}`);
  }
  process.exit(d.passed === d.total ? 0 : 1);
}
