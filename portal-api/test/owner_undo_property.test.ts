// F95 (C3): property suite over the owner seat's auto-fix apply / undo / re-scan code.
// ALL DATA IS SYNTHETIC: generated DNS zones on reserved .example names, from a seeded PRNG, no network, no model calls.
// Invariants (plan C3 bar, wA_accept R-C3):
//  P1 apply then undo restores the exact prior zone (200 generated zones, both undo orders); a refused or rolled back fix leaves the zone untouched
//  P2 undo twice is a no-op (zone AND owner state unchanged)
//  P3 a re-scan always runs after any applied fix, rolled back fix and undo, and it reads the zone AFTER the last write
//  P4 a PROVEN badge is dropped when the planted fault returns (by scan and by the monitor)
//  P5 a fix on a record with redirect= or over 10 lookups is refused (guided), with zero writes
// Mutation tests for every invariant: portal-api/scripts/mutate_undo_property.mjs (run by hand, see the F95 receipt).
import { test } from "node:test";
import assert from "node:assert/strict";
import { scanNow, setMonitor, autoFix, undoFix, monitorTick, type Ctx, type DomainState } from "../src/owner/engine.ts";
import { planFor } from "../src/owner/autofix.ts";
import { FAULTS } from "./owner_faults.ts";
import { healthy, T0, DAY } from "./owner_harness.ts";
import type { World } from "../../lib/guestscan/fixtures.ts";

import { prng, pick, chance, int, genWorld, RecZone, rigOf, writesSince, rescanAfterLastWrite, LABEL, NINC, incName, spfRecord, includeTargets, type Rng } from "./owner_undo_gen.ts";


// F173: adopt the stored state WHOLESALE. A plain Object.assign keeps a stale key the store dropped: engine.ts:121 sets `s.badge = undefined`,
// MemoryOwnerStore (structuredClone) keeps that key, D1OwnerStore (JSON) drops it, so assign would leave the old L9 badge on s under D1. A rig artefact, not a product defect.
function replaceState(s: DomainState, fresh: DomainState) { for (const k of Object.keys(s)) delete (s as Record<string, unknown>)[k]; Object.assign(s, fresh); }
const N = 200;
const counts = { zones: 0, applied: 0, guided: 0, rolled_back: 0, not_open: 0, other: 0, undone: 0 };

// ======================= P1 + P2 + P3 over 200 generated zones =======================
for (const order of ["reverse", "forward"] as const) {
  test(`${LABEL} P1 P2 P3 [${order} undo order] apply then undo restores the exact prior zone; undo twice is a no-op; re-scan always runs (${N} synthetic zones)`, async (t) => {
    const local = { applied: 0, guided: 0, rolled_back: 0, not_open: 0, other: 0, undone: 0 };
    for (let i = 0; i < N; i++) {
      const r = prng(1000 + i); const domain = `gen${i}.example`;
      const R = rigOf(genWorld(r, domain), domain);
      const s = await R.open();
      await scanNow(R.c, s, "initial");
      const S0 = R.snap();
      const fixIds: string[] = [];
      for (const check of ["SPF", "DMARC"]) {
        const before = R.snap(); const mark = R.zone.log.length; const scans0 = s.scans;
        const res = await autoFix(R.c, s, check);
        const tag = `zone ${i} ${check}`;
        if (res.ok) {
          local.applied++; fixIds.push(res.fix.id);
          assert.ok(s.scans > scans0, `${tag}: a re-scan ran after the applied fix`);
          assert.ok(rescanAfterLastWrite(R.zone), `${tag}: the re-scan read the zone after the last write`);
          assert.notDeepEqual(R.snap(), before, `${tag}: an applied fix changed something`);
        } else if (res.reason === "rolled_back") {
          local.rolled_back++;
          assert.deepEqual(R.snap(), before, `${tag}: a rolled back fix restored the zone exactly`);
          assert.ok(s.scans > scans0 && rescanAfterLastWrite(R.zone), `${tag}: rollback was followed by a re-scan`);
        } else {
          if (res.reason === "guided") local.guided++; else if (res.reason === "not_open") local.not_open++; else local.other++;
          assert.deepEqual(R.snap(), before, `${tag}: a refused fix left the zone untouched (${res.reason})`);
          assert.equal(writesSince(R.zone, mark), 0, `${tag}: zero writes on refusal`);
        }
      }
      const ids = order === "reverse" ? [...fixIds].reverse() : fixIds;
      for (const id of ids) {
        const mark = R.zone.log.length; const scans0 = s.scans;
        const u = await undoFix(R.c, s, id);
        assert.equal(u.ok, true, `zone ${i}: undo ${id} (${JSON.stringify(u)})`); local.undone++;
        assert.ok(s.scans > scans0 && R.zone.log.slice(mark).includes("w") && rescanAfterLastWrite(R.zone), `zone ${i}: undo was followed by a re-scan`);
        // P2: the second undo changes nothing at all
        const zoneB = R.snap(); const stateB = JSON.stringify(s); const logB = R.zone.log.length;
        const u2 = await undoFix(R.c, s, id);
        assert.equal(u2.ok, false); assert.equal(u2.reason, "already_reverted");
        assert.deepEqual(R.snap(), zoneB, `zone ${i}: second undo left the zone alone`);
        assert.equal(JSON.stringify(s), stateB, `zone ${i}: second undo left the owner state alone`);
        assert.equal(R.zone.log.length, logB, `zone ${i}: second undo wrote and read nothing`);
      }
      assert.deepEqual(R.snap(), S0, `zone ${i}: apply then undo restored the exact prior zone (${order})`);
    }
    t.diagnostic(`${order}: ${JSON.stringify(local)}`);
    if (order === "reverse") Object.assign(counts, { zones: N, ...local });
    // the generator must actually exercise every branch, or the property proves nothing
    assert.ok(local.applied >= 40, `applied fixes exercised (${local.applied})`);
    assert.ok(local.guided >= 10, `guided refusals exercised (${local.guided})`);
    assert.ok(local.undone >= 40, `undos exercised (${local.undone})`);
  });
}

// ======================= P4 a PROVEN badge is dropped when the planted fault returns =======================
const autoSingles = FAULTS.filter((f) => f.auto && !f.autoThenOwner && !f.id.startsWith("20"));
test(`${LABEL} P4a owner-fixed domains: a returning planted fault drops the badge, by scan and by monitor (${N} trials, synthetic)`, async (t) => {
  let viaMonitor = 0, viaScan = 0;
  for (let i = 0; i < N; i++) {
    const r = prng(5000 + i); const domain = `badge${i}.example`;
    const R = rigOf(healthy(domain), domain);
    const chosen = Array.from({ length: int(r, 1, 3) }, () => pick(r, FAULTS));
    const s = await R.open();
    for (const f of chosen) f.plant(R.zone, domain);
    const useMonitor = chance(r, 0.5);
    if (useMonitor) setMonitor(s, true, R.clock.t);
    await scanNow(R.c, s); await R.c.store.put(s);
    for (const f of chosen) await f.ownerFix(R.zone, domain);
    await scanNow(R.c, s); await R.c.store.put(s);
    assert.equal(s.badge?.level, 9, `trial ${i}: all six controls PASS gives the L9 badge`);
    const f = pick(r, chosen);
    f.plant(R.zone, domain); // the fault returns
    R.clock.t += DAY;
    let alerts: string[] = [];
    if (useMonitor) { viaMonitor++; const tick = await monitorTick(R.c); alerts = tick.alerts.map((a) => a.kind); replaceState(s, (await R.c.store.get("dom_1"))!); }
    else { viaScan++; await scanNow(R.c, s); }
    assert.equal(s.findings[f.check].state, "REGRESSED", `trial ${i} ${f.id}: finding regressed`);
    assert.ok(!s.badge || s.badge.level < 9, `trial ${i} ${f.id}: the L9 badge is gone`);
    const lost = s.badgeHistory.find((b) => b.level === 9);
    assert.match(lost?.lostBecause ?? "", /fault returned/, `trial ${i}: badge history says why`);
    assert.ok(s.events.some((e) => e.kind === "badge_lost"), `trial ${i}: badge_lost event`);
    if (useMonitor) assert.ok(alerts.includes("badge_lost") && alerts.includes("regressed"), `trial ${i}: monitor alerted the owner (${alerts})`);
  }
  t.diagnostic(`trials ${N}: via scan ${viaScan}, via monitor ${viaMonitor}`);
});
test(`${LABEL} P4b auto-fixed domains: badge earned by an auto-fix is dropped when the fault returns (${autoSingles.length} auto-fixable faults x 10 repeats, synthetic)`, async () => {
  for (const f of autoSingles) for (let k = 0; k < 10; k++) {
    const domain = `auto${k}.example`; const R = rigOf(healthy(domain), domain);
    const s = await R.open(); f.plant(R.zone, domain); await scanNow(R.c, s);
    const res = await autoFix(R.c, s, f.check); assert.equal(res.ok, true, `${f.id}: ${JSON.stringify(res)}`);
    assert.equal(s.badge?.level, 9, `${f.id}: badge earned only after the proving re-scan`);
    f.plant(R.zone, domain); R.clock.t += DAY; await scanNow(R.c, s);
    assert.equal(s.findings[f.check].state, "REGRESSED", f.id);
    assert.ok(!s.badge || s.badge.level < 9, `${f.id}: badge dropped when the fault returned`);
  }
});

// ======================= P5 redirect= and over-10-lookups are refused (guided) =======================
// Independent oracle (does not call spfInfo): the lookup-bearing terms of the merged record.
const lookupTerms = (recs: string[]) => { const set = new Set<string>(); for (const rec of recs) for (const t of rec.trim().split(/\s+/).slice(1)) { if (/^[+\-~?]*all$/i.test(t)) continue; set.add(t); } return [...set].filter((t) => /^(redirect=|[+\-~?]?(include:|exists:|a\b|mx\b|ptr\b))/i.test(t)); };
test(`${LABEL} P5a SPF with redirect= is refused: guided, zero writes, zone untouched (${N} synthetic records)`, async () => {
  for (let i = 0; i < N; i++) {
    const r = prng(9000 + i); const domain = `redir${i}.example`;
    const rec = spfRecord(r, { redirect: true, maxIncludes: 4, allTerm: pick(r, ["-all", "~all", "all", "+all", null]) });
    const extra = chance(r, 0.3) ? [spfRecord(r, { maxIncludes: 2 })] : []; // optional second SPF record next to it
    const w = healthy(domain); Object.assign(w.txt!, includeTargets(r)); w.txt![domain] = [rec, ...extra];
    const R = rigOf(w, domain); const s = await R.open(); await scanNow(R.c, s);
    const plan = await planFor("SPF", domain, R.zone);
    assert.equal(plan.auto, false, `${rec}: planFor refuses`); assert.equal(plan.edits.length, 0);
    const S0 = R.snap(); const res = await autoFix(R.c, s, "SPF");
    assert.equal(res.ok, false, rec); assert.ok(["guided", "not_open"].includes((res as any).reason), `${rec}: ${(res as any).reason}`);
    assert.deepEqual(R.snap(), S0); assert.equal(R.zone.log.filter((x) => x === "w").length, 0, "zero writes");
  }
});
test(`${LABEL} P5b SPF over 10 DNS lookups (one record, or two records that would merge over the limit) is refused; under the limit is NOT refused (${N} synthetic records)`, async (t) => {
  let over = 0, under = 0;
  for (let i = 0; i < N; i++) {
    const r = prng(13000 + i); const domain = `lim${i}.example`;
    const two = chance(r, 0.5);
    const recs = two ? [spfRecord(r, { minIncludes: 3, maxIncludes: 9, allTerm: pick(r, ["-all", "~all"]) }), spfRecord(r, { minIncludes: 3, maxIncludes: 9, allTerm: pick(r, ["-all", "~all"]) })] : [spfRecord(r, { minIncludes: 5, maxIncludes: 14, allTerm: pick(r, ["~all", "all", "+all"]) })];
    const merged = lookupTerms(recs); const hasOdd = recs.some((x) => /\bptr\b|foo:bar/.test(x));
    const w = healthy(domain); w.txt![domain] = recs; // include targets absent: top-level count is what is under test
    const R = rigOf(w, domain); const s = await R.open(); await scanNow(R.c, s);
    const S0 = R.snap(); const plan = await planFor("SPF", domain, R.zone);
    if (merged.length > 10 || hasOdd) {
      over++; assert.equal(plan.auto, false, `${recs.join(" | ")}: ${merged.length} lookups, refused`);
      const res = await autoFix(R.c, s, "SPF"); assert.equal(res.ok, false);
      assert.deepEqual(R.snap(), S0, "zone untouched"); assert.equal(R.zone.log.filter((x) => x === "w").length, 0, "zero writes");
    } else { under++; assert.equal(plan.auto, true, `${recs.join(" | ")}: ${merged.length} lookups, allowed (the guard is not a blanket refusal)`); }
  }
  assert.ok(over >= 30 && under >= 20, `both sides exercised: over ${over}, under ${under}`);
  t.diagnostic(`over-limit or odd terms ${over}, allowed ${under}`);
});
test(`${LABEL} P5c nested includes that push the real count over 10 while the top level is under: a fix never leaves the zone worse, and never claims a proof it lacks (synthetic)`, async (t) => {
  let tried = 0, refused = 0, rolled = 0, applied = 0;
  for (let i = 0; i < N; i++) {
    const r = prng(17000 + i); const domain = `nest${i}.example`;
    const w = healthy(domain); Object.assign(w.txt!, includeTargets(r));
    w.txt![domain] = [spfRecord(r, { minIncludes: 3, maxIncludes: 6, allTerm: pick(r, ["~all", "?all", null]) })];
    const R = rigOf(w, domain); const s = await R.open(); await scanNow(R.c, s);
    if (s.findings.SPF.state !== "OPEN") continue;
    tried++; const S0 = R.snap(); const res = await autoFix(R.c, s, "SPF");
    if (res.ok) { applied++; assert.equal(s.findings.SPF.status === "PASS" || s.findings.SPF.status === "WARN", true); assert.notEqual(s.findings.SPF.state, "REGRESSED"); }
    else { if (res.reason === "guided") refused++; if (res.reason === "rolled_back") { rolled++; assert.deepEqual(R.snap(), S0, `rollback restored the zone exactly: ${s.domain}`); } }
  }
  assert.ok(tried >= 20); t.diagnostic(`tried ${tried}: applied ${applied}, guided ${refused}, rolled back ${rolled}`);
});
test("zone counts are reported for the receipt", (t) => { t.diagnostic(JSON.stringify(counts)); });
