import { test } from "node:test";
import assert from "node:assert/strict";
import { rig, DAY } from "./owner_harness.ts";
import { FAULTS } from "./owner_faults.ts";
import * as eng from "../src/owner/engine.ts";
import { autoFix, undoFix, questsOf, monitorTick, report, observe, hoursGivenBack } from "../src/owner/engine.ts";
import { computeLevel, LEVELS } from "../src/owner/levels.ts";
import { MemoryZone } from "../src/owner/dnsw.ts";
import { planFor } from "../src/owner/autofix.ts";

// ============ KILL TEST: 20 planted faults fixed and re-proven end to end; badge lost when the fault returns ============
for (const f of FAULTS) {
  test(`kill test fault ${f.id}: found, fixed, re-proven, badge lost when it returns, re-proven again`, async () => {
    const R = rig();
    const s = await R.open();
    f.plant(R.zone, R.domain);
    R.monitorOn(s);
    await R.scan(s);
    // 1 FOUND, with a proof state of OPEN and a quest
    assert.equal(s.findings[f.check].state, "OPEN", "fault found");
    assert.ok(questsOf(s).open.some((q) => q.check === f.check), "a quest exists for the fault");
    const lvlFaulty = s.level;
    assert.ok(lvlFaulty < 9, `a faulty domain is below L9 (was L${lvlFaulty})`);
    assert.equal(s.badge === undefined || s.badge.level < 9, true);
    // 2 FIX: auto where safe, owner edit otherwise. Never marked fixed by anything but a re-scan.
    const plan = await planFor(f.check, R.domain, R.zone);
    assert.equal(plan.auto, f.auto, `auto-fixable expectation for ${f.id}: ${plan.reason ?? plan.summary}`);
    if (f.auto) {
      const ar = await autoFix(R.c, s, f.check);
      assert.equal(ar.ok, true, JSON.stringify(ar));
      if (f.autoThenOwner) { assert.equal((ar as any).result, "partial"); assert.equal(s.findings[f.check].state, "OPEN", "p=none is an improvement, not a proof"); }
    } else {
      const ar = await autoFix(R.c, s, f.check);
      assert.equal(ar.ok, false); assert.equal((ar as any).reason, "guided", "we refuse to guess");
      assert.equal(s.findings[f.check].state, "OPEN", "a refused fix proves nothing");
    }
    if (!f.auto || f.autoThenOwner || f.id.startsWith("20")) { await f.ownerFix(R.zone, R.domain); }
    R.clock.t += 1000;
    await R.scan(s, "owner re-scan");
    // 3 RE-PROVEN end to end
    for (const k of f.id.startsWith("20") ? ["SPF", "DMARC"] : [f.check]) {
      assert.equal(s.findings[k].state, "PROVEN_FIXED", `${k} proven by re-scan`);
      assert.equal(s.findings[k].status, "PASS");
      assert.match(s.findings[k].proof!.scanId, /^scn_\d+$/);
    }
    assert.equal(s.level, 10 - 1, "all six controls pass: L9 (L10 needs 30 clean days with the monitor on)");
    assert.equal(s.badge!.level, 9);
    assert.equal(questsOf(s).open.length, 0);
    assert.ok(s.minutesHandedBack > 0, "hours given back were credited");
    // 4 THE FAULT RETURNS: monitor catches it, finding REGRESSED, badge lost, alert raised
    f.plant(R.zone, R.domain);
    R.clock.t = s.monitor.nextScanAt!;
    const t = await monitorTick(R.c);
    assert.equal(t.scanned, 1);
    const s2 = (await R.c.store.get("dom_1"))!;
    assert.equal(s2.findings[f.check].state, "REGRESSED", "fault returned");
    assert.ok(s2.level < 9);
    assert.equal(s2.badge === undefined || s2.badge.level < 9, true, "the L9 badge is gone");
    assert.ok(s2.badgeHistory.some((b) => b.level === 9 && b.lostBecause?.includes("fault returned")), "badge history says why");
    assert.ok(t.alerts.some((a) => a.kind === "badge_lost") && t.alerts.some((a) => a.kind === "regressed"));
    assert.ok(questsOf(s2).open.some((q) => q.check === f.check), "the quest is re-opened");
    // 5 FIXED AGAIN: badge comes back only by proof; hours are not double-credited
    const mins = s2.minutesHandedBack;
    await f.ownerFix(R.zone, R.domain);
    R.clock.t += 1000;
    await R.scan(s2, "owner re-scan 2");
    assert.equal(s2.findings[f.check].state, "PROVEN_FIXED");
    assert.equal(s2.badge!.level, 9);
    assert.equal(s2.minutesHandedBack, mins, "no double credit");
  });
}
test("kill test: the 20 faults are 20 distinct plantings", () => {
  assert.equal(FAULTS.length, 20);
  assert.equal(new Set(FAULTS.map((f) => f.id)).size, 20);
  assert.ok(new Set(FAULTS.map((f) => f.check)).size >= 6, "all six controls are covered");
});

// ============ proof discipline ============
test("nothing can be marked fixed without a scan: the engine exports no mark-fixed function", () => {
  for (const k of Object.keys(eng)) assert.doesNotMatch(k, /^(markFixed|setProven|forceFixed|markProven|completeQuest)/i, k);
});
test("a zone that silently drops our write: not proven, rolled back, finding stays OPEN, notProven counted", async () => {
  const R = rig(); const s = await R.open();
  R.zone.world.txt![R.domain] = ["v=spf1 include:_spf.google.com +all"];
  const lying = R.zone; const real = lying.setTxt.bind(lying); lying.setTxt = async (n: string, v: string[]) => { lying.writes.push({ op: "dropped", name: n }); void real; };
  await R.scan(s);
  const r = await autoFix(R.c, s, "SPF");
  assert.equal(r.ok, false); assert.equal((r as any).reason, "rolled_back");
  assert.equal(s.findings.SPF.state, "OPEN"); assert.equal(s.findings.SPF.notProven, 1);
  assert.equal(s.fixes[0].status, "rolled_back");
});
test("an auto-fix that breaks another control is rolled back (collateral), exact records restored", async () => {
  const R = rig(); const s = await R.open();
  R.zone.world.txt![R.domain] = ["v=spf1 include:_spf.google.com ~all"];
  await R.scan(s);
  const real = R.zone.setTxt.bind(R.zone);
  R.zone.setTxt = async (n: string, v: string[]) => { await real(n, v); await real(`_dmarc.${R.domain}`, []); }; // a buggy adapter wipes DMARC too
  const before = JSON.stringify(R.zone.world.txt![R.domain]);
  const r = await autoFix(R.c, s, "SPF");
  assert.equal((r as any).reason, "rolled_back"); assert.match((r as any).detail, /broke DMARC/);
  R.zone.setTxt = real;
  assert.equal(JSON.stringify(R.zone.world.txt![R.domain]), before, "SPF restored exactly");
});
test("UNKNOWN (a failed DNS read) never proves a fix and never regresses a proven one", async () => {
  const R = rig(); const s = await R.open();
  R.zone.world.txt![R.domain] = ["v=spf1 include:_spf.google.com ~all"];
  await R.scan(s); assert.equal(s.findings.SPF.state, "OPEN");
  R.zone.world.servfail = [`${R.domain}/TXT`]; await R.scan(s);
  assert.equal(s.findings.SPF.state, "OPEN", "SERVFAIL is not a pass");
  R.zone.world.servfail = undefined; R.zone.world.txt![R.domain] = ["v=spf1 include:_spf.google.com -all"]; await R.scan(s);
  assert.equal(s.findings.SPF.state, "PROVEN_FIXED");
  R.zone.world.servfail = [`${R.domain}/TXT`]; await R.scan(s);
  assert.equal(s.findings.SPF.state, "PROVEN_FIXED", "SERVFAIL is not a fail either: no false regression");
  assert.ok(s.badge, "badge kept through a flaky read");
});
test("auto-fix is reversible: undo restores the exact previous records and the re-scan re-opens the finding", async () => {
  const R = rig(); const s = await R.open();
  const faulty = ["v=spf1 include:_spf.google.com ~all"]; R.zone.world.txt![R.domain] = faulty;
  await R.scan(s);
  const r = await autoFix(R.c, s, "SPF"); assert.equal((r as any).result, "proven");
  assert.deepEqual(R.zone.world.txt![R.domain], ["v=spf1 include:_spf.google.com -all"]);
  const u = await undoFix(R.c, s, s.fixes[0].id); assert.equal(u.ok, true);
  assert.deepEqual(R.zone.world.txt![R.domain], faulty, "exact previous record set");
  assert.equal(s.fixes[0].status, "undone"); assert.equal(s.findings.SPF.state, "REGRESSED"); assert.equal(s.badge === undefined || s.badge.level < 9, true);
  assert.equal((await undoFix(R.c, s, s.fixes[0].id)).reason, "already_reverted");
});
test("undo refuses to clobber an edit made after our fix", async () => {
  const R = rig(); const s = await R.open();
  R.zone.world.txt![R.domain] = ["v=spf1 include:_spf.google.com ~all"]; await R.scan(s);
  await autoFix(R.c, s, "SPF");
  R.zone.world.txt![R.domain] = ["v=spf1 include:_spf.google.com include:new.example -all"]; // owner edited since
  assert.equal((await undoFix(R.c, s, "fix_1")).reason, "zone_changed_since");
  assert.deepEqual(R.zone.world.txt![R.domain], ["v=spf1 include:_spf.google.com include:new.example -all"]);
});
test("auto-fix keeps every sender in SPF and refuses to guess when there are none or none exist", async () => {
  const R = rig();
  R.zone.world.txt![R.domain] = ["v=spf1 include:a.example ip4:203.0.113.5 mx +all"];
  const p = await planFor("SPF", R.domain, R.zone);
  assert.equal(p.auto, true); assert.equal(p.edits[0].after[0], "v=spf1 include:a.example ip4:203.0.113.5 mx -all");
  R.zone.world.txt![R.domain] = ["v=spf1 +all"]; assert.equal((await planFor("SPF", R.domain, R.zone)).auto, false, "+all alone names no senders: -all would block all mail");
  delete R.zone.world.txt![R.domain]; assert.equal((await planFor("SPF", R.domain, R.zone)).auto, false);
});
test("auto-fix needs a connected zone, and only acts on OPEN or REGRESSED findings", async () => {
  const R = rig(); const s = await R.open();
  R.zone.world.txt![R.domain] = ["v=spf1 include:_spf.google.com ~all"]; await R.scan(s);
  const noZone = { ...R.c, zones: { zoneFor: () => undefined } };
  assert.equal(((await autoFix(noZone, s, "SPF")) as any).reason, "no_zone");
  assert.equal(((await autoFix(R.c, s, "DKIM")) as any).reason, "not_open");
  assert.equal(((await autoFix(R.c, s, "NOPE")) as any).reason, "unknown_check");
  assert.equal(R.zone.writes.length, 0, "no zone write happened on any refused path");
});
test("every auto-fix is followed by a re-scan (the scan count grows by the fix's re-scans)", async () => {
  const R = rig(); const s = await R.open();
  R.zone.world.txt![R.domain] = ["v=spf1 include:_spf.google.com ~all"]; await R.scan(s);
  const n = s.scans; await autoFix(R.c, s, "SPF");
  assert.equal(s.scans, n + 1);
  assert.equal(s.events.filter((e) => e.kind === "proven_fixed").length, 1);
});

// ============ levels ============
test("levels: L0 to L10 are exact, cumulative, and L10 needs the monitor plus 30 clean days", async () => {
  const R = rig(); const s = await R.open(false);
  assert.equal(s.level, 0);
  const o = await R.open(true); assert.equal(o.level, 1);
  const full = { domainVerified: true, monitorActive: true, cleanDays: 30 };
  const r = await (await import("../../lib/guestscan/scan.ts")).runScan(R.domain, R.zone.doh);
  assert.equal(computeLevel(r, full).level, 10);
  assert.equal(computeLevel(r, { ...full, cleanDays: 29 }).level, 9);
  assert.equal(computeLevel(r, { ...full, monitorActive: false }).level, 9);
  assert.equal(computeLevel(r, { ...full, domainVerified: false }).level, 0, "unverified domain: no level");
  assert.equal(computeLevel(undefined, { domainVerified: true, monitorActive: false, cleanDays: 0 }).level, 1);
  assert.equal(LEVELS.length, 10);
});
test("levels climb with proof: bare domain L2, SPF L3, DMARC p=none L4, DKIM+SPF L5, quarantine L6, reject L7, DNSSEC+MX L8, MTA-STS L9", async () => {
  const R = rig(); const s = await R.open(); R.zone.world = { txt: {} } as any; R.zone.world.txt = {};
  const seen: number[] = [];
  const step = async (mut: () => void) => { mut(); R.clock.t += 1000; await R.scan(s); seen.push(s.level); };
  const d = R.domain, T = R.zone.world.txt!;
  await step(() => {}); await step(() => { T[d] = ["v=spf1 include:_spf.google.com ~all"]; });
  await step(() => { T[`_dmarc.${d}`] = ["v=DMARC1; p=none; rua=mailto:a@b.example"]; });
  await step(() => { T[d] = ["v=spf1 include:_spf.google.com -all"]; T[`google._domainkey.${d}`] = ["v=DKIM1; p=ABCDEF"]; });
  await step(() => { T[`_dmarc.${d}`] = ["v=DMARC1; p=quarantine"]; });
  await step(() => { T[`_dmarc.${d}`] = ["v=DMARC1; p=reject; pct=100"]; });
  await step(() => { R.zone.world.ds = true; R.zone.world.mx = ["10 mx.example."]; });
  await step(() => { T[`_mta-sts.${d}`] = ["v=STSv1; id=1"]; });
  assert.deepEqual(seen, [2, 3, 4, 5, 6, 7, 8, 9]);
});
test("L10 over time: monitor on, 30 clean days pass, then the level and badge reach 10; a regression resets the streak and drops it", async () => {
  const R = rig(); const s = await R.open(); R.monitorOn(s); await R.scan(s);
  assert.equal(s.level, 9);
  for (let i = 1; i <= 29; i++) { R.clock.t += DAY; await monitorTick(R.c); }
  assert.equal((await R.c.store.get("dom_1"))!.level, 9, "29 clean days is not enough");
  R.clock.t += DAY; await monitorTick(R.c);
  let cur = (await R.c.store.get("dom_1"))!; assert.equal(cur.level, 10); assert.equal(cur.badge!.level, 10);
  R.zone.world.txt![R.domain] = ["v=spf1 include:_spf.google.com ~all"]; R.clock.t += DAY;
  const t = await monitorTick(R.c); cur = (await R.c.store.get("dom_1"))!;
  assert.ok(cur.level < 9); assert.equal(cur.allPassSince, undefined); assert.ok(t.alerts.length >= 2);
  assert.ok(cur.badgeHistory.some((b) => b.level === 10 && b.lostBecause));
});

// ============ monitor ============
test("monitor: only due, only active domains are scanned; a second tick in the same instant scans nothing", async () => {
  const R = rig(); const s = await R.open(); await R.scan(s);
  assert.equal((await monitorTick(R.c)).scanned, 0, "monitor off: never scanned");
  R.monitorOn(s); await R.save(s);
  assert.equal((await monitorTick(R.c)).scanned, 1);
  assert.equal((await monitorTick(R.c)).scanned, 0, "not due again until the interval passes");
  R.clock.t += DAY - 1; assert.equal((await monitorTick(R.c)).scanned, 0);
  R.clock.t += 1; assert.equal((await monitorTick(R.c)).scanned, 1);
});
test("monitor: a healthy domain raises no alerts; turning it off stops scans", async () => {
  const R = rig(); const s = await R.open(); R.monitorOn(s); await R.save(s);
  R.clock.t += DAY; const t = await monitorTick(R.c); assert.equal(t.alerts.length, 0);
  const cur = (await R.c.store.get("dom_1"))!; eng.setMonitor(cur, false, R.clock.t); await R.save(cur);
  R.clock.t += 3 * DAY; assert.equal((await monitorTick(R.c)).scanned, 0);
});

// ============ quests, hours, reports ============
test("quests: ordered critical first, completed only by proof, xp 100/50", async () => {
  const R = rig(); const s = await R.open();
  const T = R.zone.world.txt!; delete T[`_dmarc.${R.domain}`]; R.zone.world.ds = false; T[R.domain] = ["v=spf1 include:_spf.google.com +all"];
  await R.scan(s);
  const q = questsOf(s).open; assert.deepEqual(q.map((x) => x.check), ["SPF", "DMARC", "DNSSEC"]);
  assert.deepEqual(q.map((x) => x.xp), [100, 100, 50]); assert.deepEqual(q.map((x) => x.kind), ["auto", "auto", "guided"]);
  assert.equal(questsOf(s).done.length, 0);
  await autoFix(R.c, s, "SPF"); assert.equal(questsOf(s).done.length, 1);
});
test("hours given back: credited once per proven check from the modelled table, labelled MODELLED", async () => {
  const R = rig(); const s = await R.open();
  R.zone.world.txt![R.domain] = ["v=spf1 include:_spf.google.com ~all"]; await R.scan(s);
  await autoFix(R.c, s, "SPF");
  assert.equal(s.minutesHandedBack, 45 - 5);
  const h = hoursGivenBack(s); assert.equal(h.hours, 0.7); assert.match(h.label, /MODELLED/);
  R.zone.world.txt![R.domain] = ["v=spf1 include:_spf.google.com ~all"]; await R.scan(s); await autoFix(R.c, s, "SPF");
  assert.equal(s.minutesHandedBack, 40, "a repeat fix of the same check is not paid twice");
});
test("report: states proof per finding, shows the lost badge and hours, labels the estimate, zero dashes of the banned kind", async () => {
  const R = rig(); const s = await R.open(); R.monitorOn(s);
  R.zone.world.txt![R.domain] = ["v=spf1 include:_spf.google.com ~all"]; await R.scan(s); await autoFix(R.c, s, "SPF"); await R.save(s);
  R.zone.world.txt![R.domain] = ["v=spf1 include:_spf.google.com ~all"]; R.clock.t += DAY; await monitorTick(R.c);
  const cur = (await R.c.store.get("dom_1"))!;
  const rep = report(cur, R.clock.t);
  assert.match(rep.markdown, /SPF: REGRESSED/); assert.match(rep.markdown, /badge lost/i); assert.match(rep.markdown, /MODELLED/);
  assert.match(rep.markdown, /DMARC: MONITORING/);
  assert.doesNotMatch(rep.markdown, /[–—]/, "no em or en dashes");
  assert.doesNotMatch(rep.markdown, /\b(leverage|robust|holistic|delve|seamless)\b/i);
  assert.equal(rep.json.badge!.level, 4, "badge fell from L9 to L4, not to nothing"); assert.equal(rep.json.findings.length, 6);
});
test("observe is a pure state machine: replaying the same scans gives the same state (determinism)", async () => {
  const mk = async () => { const R = rig(); const s = await R.open(); R.zone.world.txt![R.domain] = ["v=spf1 include:x.example ~all"]; const r1 = await R.scan(s); R.zone.world.txt![R.domain] = ["v=spf1 include:x.example -all"]; R.clock.t += 5; const r2 = await R.scan(s); return JSON.stringify([s.findings, s.level, s.badge, s.minutesHandedBack, r1.grade, r2.grade]); };
  assert.equal(await mk(), await mk());
});
test("zero model calls: the owner seat source names no model or LLM client", async () => {
  const fs = await import("node:fs"); const dir = new URL("../src/owner/", import.meta.url);
  for (const f of fs.readdirSync(dir)) assert.doesNotMatch(fs.readFileSync(new URL(f, dir), "utf8"), /anthropic|openai|gemini|claude-|gpt-|\.messages\.create|chat\.completions/i, f);
});

// R-C3 regressions: auto-fix must refuse (guided, no DNS write) where adding -all would break mail.
const refuses = async (records: string[], reasonRx: RegExp) => {
  const R = rig(); const s = await R.open();
  R.zone.world.txt![R.domain] = records; await R.scan(s);
  const before = JSON.stringify(R.zone.world.txt![R.domain]); const writes = R.zone.writes.length;
  const plan = await planFor("SPF", R.domain, R.zone);
  assert.equal(plan.auto, false); assert.match(plan.reason ?? "", reasonRx); assert.deepEqual(plan.edits, []);
  const r: any = await autoFix(R.c, s, "SPF");
  assert.equal(r.ok, false); assert.notEqual(r.result, "proven");
  assert.equal(JSON.stringify(R.zone.world.txt![R.domain]), before, "DNS untouched");
  assert.equal(R.zone.writes.length, writes, "no DNS write attempted");
  assert.notEqual(s.findings.SPF.state, "PROVEN_FIXED");
};
test("R-C3: redirect= record without all: auto-fix refuses, no DNS write", async () => { await refuses(["v=spf1 redirect=_spf.bigmail.example.com"], /redirect/); });
test("R-C3: redirect= record with ~all: auto-fix refuses, no DNS write", async () => { await refuses(["v=spf1 redirect=_spf.bigmail.example.com ~all"], /redirect/); });
test("R-C3: merged includes over 10 lookups: auto-fix refuses, no DNS write", async () => {
  const inc = (p: string, n: number) => Array.from({ length: n }, (_, i) => `include:${p}${i}.example.com`).join(" ");
  await refuses([`v=spf1 ${inc("a", 5)} ~all`, `v=spf1 ${inc("b", 6)} -all`], /lookups/);
});
test("R-C3: a single record already over 10 lookups: auto-fix refuses", async () => {
  await refuses([`v=spf1 ${Array.from({ length: 12 }, (_, i) => `include:i${i}.example.com`).join(" ")} ~all`], /lookups/);
});
test("R-C3: ptr / unreadable terms are guided, not rewritten", async () => { await refuses(["v=spf1 ptr ~all"], /ptr|cannot read/); await refuses(["v=spf1 bogus:thing ~all"], /ptr|cannot read/); });
test("R-C3: the safe case still auto-fixes (10 lookups exactly, merged)", async () => {
  const R = rig(); const s = await R.open();
  const inc = (p: string, n: number) => Array.from({ length: n }, (_, i) => `include:${p}${i}.example.com`).join(" ");
  R.zone.world.txt![R.domain] = [`v=spf1 ${inc("a", 5)} ~all`, `v=spf1 ${inc("b", 5)} -all`]; await R.scan(s);
  const plan = await planFor("SPF", R.domain, R.zone); assert.equal(plan.auto, true);
  const r: any = await autoFix(R.c, s, "SPF"); assert.equal(r.result, "proven");
});
