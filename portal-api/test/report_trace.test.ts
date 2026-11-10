// C3 report trace: every figure in the owner report traces to a recorded scan, finding, fix or undo, in both formats.
// 30 SYNTHETIC domains (deterministic seeds, *.example, no live data: live stays PENDING LIVE).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rig, DAY } from "./owner_harness.ts";
import { FAULTS } from "./owner_faults.ts";
import { autoFix, undoFix, report, type DomainState } from "../src/owner/engine.ts";
import { checkReportTrace } from "../src/owner/reporttrace.ts";

const mulberry32 = (a: number) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
type Syn = { name: string; s: DomainState; now: number; flags: { undone: boolean; returned: boolean; fixed: boolean; badge: boolean; unreadable: boolean }; modelCalls: number };

async function synth(seed: number): Promise<Syn> {
  const rnd = mulberry32(seed), pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const name = `synthetic-${String(seed).padStart(2, "0")}.example`; // SYNTHETIC
  const R = rig(name); const s = await R.open(); let modelCalls = 0;
  const scan = async () => { const r = await R.scan(s); modelCalls += r.modelCalls; };
  const faults = Array.from({ length: Math.floor(rnd() * 4) }, () => pick(FAULTS));
  if (rnd() < 0.7) R.monitorOn(s);
  faults.forEach((f) => f.plant(R.zone, name));
  await scan();
  const flags = { undone: false, returned: false, fixed: false, badge: false, unreadable: false };
  for (const f of faults) {
    if (s.findings[f.check]?.state !== "OPEN") continue;
    if (f.auto && rnd() < 0.8) await autoFix(R.c, s, f.check); else if (rnd() < 0.6) { await f.ownerFix(R.zone, name); R.clock.t += 60_000; await scan(); }
  }
  await R.save(s);
  if (rnd() < 0.35) { const fx = s.fixes.find((x) => x.status === "proven" || x.status === "partial"); if (fx) { R.clock.t += DAY; flags.undone = (await undoFix(R.c, s, fx.id)).ok; } }
  if (rnd() < 0.35 && faults.length) { const f = pick(faults); R.clock.t += DAY; f.plant(R.zone, name); await scan(); flags.returned = true; }
  if (rnd() < 0.2) { R.zone.world.servfail = [`_dmarc.${name}`]; R.clock.t += DAY; await scan(); flags.unreadable = true; }
  await R.save(s);
  const stored = (await R.c.store.get("dom_1"))!; // always report from what the store holds
  flags.fixed = stored.minutesHandedBack > 0; flags.badge = !!stored.badge;
  return { name, s: stored, now: R.clock.t + 3600_000, flags, modelCalls };
}
const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);
let cache: Syn[] | undefined;
const all = async () => (cache ??= await Promise.all(SEEDS.map(synth)));

type ReportFn = typeof report;
function audit(fn: ReportFn, doms: Syn[]): string[] {
  const out: string[] = [];
  for (const d of doms) {
    const a = fn(structuredClone(d.s), d.now), b = fn(structuredClone(d.s), d.now);
    if (a.markdown !== b.markdown || JSON.stringify(a.json) !== JSON.stringify(b.json)) out.push(`${d.name}: nondeterministic (same store state, different bytes)`);
    for (const v of checkReportTrace(d.s, d.now, a)) out.push(`${d.name}: ${v}`);
  }
  return out;
}

test("SYNTHETIC corpus: 30 seeded domains cover fixed, undone, returned-fault, unreadable and badge cases", async () => {
  const doms = await all(); assert.equal(doms.length, 30);
  const n = (k: keyof Syn["flags"]) => doms.filter((d) => d.flags[k]).length;
  for (const k of ["undone", "returned", "fixed", "badge", "unreadable"] as const) assert.ok(n(k) >= 3, `corpus has at least 3 domains with ${k} (has ${n(k)})`);
  assert.ok(doms.every((d) => d.name.startsWith("synthetic-") && d.name.endsWith(".example")), "SYNTHETIC names only");
});
test("report trace: all 30 domains pass (1 parity, 2 traceable, 3 MODELLED hours, 4 not-fixed honesty, 5 deterministic)", async () => {
  assert.deepEqual(audit(report, await all()), []);
});
test("hours given back: every non-zero figure is MODELLED with method and floor, never money, in both formats", async () => {
  let seen = 0;
  for (const d of await all()) {
    const r = report(d.s, d.now); const h = r.json.hours;
    assert.match(h.label, /^MODELLED/); assert.match(h.label, /fixes\.ts/); assert.match(h.floor, /^Floor: 0 hours/);
    assert.ok(r.markdown.includes(`${h.hours} hours (${h.minutes} minutes). ${h.label}. ${h.floor}.`));
    assert.doesNotMatch(r.markdown, /\$|\b(AUD|USD)\b/); if (h.minutes > 0) seen++;
  }
  assert.ok(seen >= 3, `non-zero hours seen on ${seen} domains`);
});
test("an undone fix or a returned fault is shown as not fixed, hours drop, and no proof line remains", async () => {
  let u = 0, rt = 0;
  for (const d of await all()) {
    const r = report(d.s, d.now);
    for (const x of d.s.fixes) if (x.status === "undone") { u++; assert.match(r.markdown, new RegExp(`- ${x.check}: .*\\(undone, not fixed\\)`)); }
    for (const f of Object.values(d.s.findings)) if (f.state === "REGRESSED") { rt++; assert.doesNotMatch(r.markdown, new RegExp(`- ${f.check}: .*Proven by`)); }
  }
  assert.ok(u >= 1 && rt >= 3, `undone ${u}, regressed ${rt}`);
});
test("zero model calls: scans made 0, report generation never touches fetch, source names no model client", async () => {
  const doms = await all(); assert.equal(doms.reduce((a, d) => a + d.modelCalls, 0), 0);
  const realFetch = globalThis.fetch; let hits = 0; globalThis.fetch = (() => { hits++; throw new Error("network in report"); }) as typeof fetch;
  try { for (const d of doms) { const r = report(d.s, d.now); assert.ok(!(r instanceof Promise)); checkReportTrace(d.s, d.now, r); } } finally { globalThis.fetch = realFetch; }
  assert.equal(hits, 0);
  const src = fs.readFileSync(new URL("../src/owner/reporttrace.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /anthropic|openai|gemini|claude-|gpt-|\.messages\.create|chat\.completions/i);
});

// ---- mutants: each one breaks the report in a way the trace must catch ----
const MUT = new URL("./.mut/", import.meta.url);
const SRC = fs.readFileSync(new URL("../src/owner/engine.ts", import.meta.url), "utf8");
const MUTANTS: [string, string, string][] = [
  ["drop the MODELLED label", 'label: "MODELLED estimate:', 'label: "estimate:'],
  ["count an undone fix", '.filter((f) => f.state === "PROVEN_FIXED" && f.credited)', ".filter((f) => f.credited)"],
  ["round a figure up", "hours: Math.round((minutes / 60) * 10) / 10, label", "hours: Math.ceil((minutes / 60) * 10) / 10, label"],
  ["reorder rows non-deterministically", "const fs = Object.values(s.findings);", "const fs = Object.values(s.findings).sort(() => Math.random() - 0.5);"],
  ["show a returned fault as a standing fix", 's.findings[x.check]?.state !== "PROVEN_FIXED" ? "fault returned, not fixed now"', 'false ? "fault returned, not fixed now"'],
  ["drop the floor line from the markdown", "${h.label}. ${h.floor}.`", "${h.label}.`"],
];
for (const [name, from, to] of MUTANTS) {
  test(`mutant must fail: ${name}`, async () => {
    assert.equal(SRC.split(from).length, 2, "mutation site matches exactly once");
    fs.mkdirSync(MUT, { recursive: true });
    const file = new URL(`./m_${process.pid}_${name.replace(/\W+/g, "_")}.ts`, MUT);
    fs.writeFileSync(file, SRC.replace(from, to).replaceAll('from "./', 'from "../../src/owner/'));
    try {
      const mod = await import(file.href);
      const found = audit(mod.report, await all());
      assert.ok(found.length > 0, `mutant "${name}" survived: the trace did not notice`);
    } finally { fs.rmSync(file, { force: true }); }
  });
}
test("unmutated engine passes the same audit (control for the mutants)", async () => {
  assert.deepEqual(audit(report, await all()), []);
});
