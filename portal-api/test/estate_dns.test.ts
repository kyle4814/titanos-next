// F30: the estate view backed by the C1 scanner/grader through an injected resolver. FAKE RESOLVERS ONLY: no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnt } from "./ent_harness.ts";
import { dnsScan, toScanFindings } from "../src/enterprise/estate_dns.ts";
import { runScan, type DohFetch, type DohResponse } from "../../lib/guestscan/scan.ts";
import { FIXTURES, fakeDoh, type World } from "../../lib/guestscan/fixtures.ts";

const SRC = "FAKE test resolver";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// A world where a portal-valid domain is perfectly configured, rewritten from the C1 "perfect" fixture.
const rename = (w: World, from: string, to: string): World => JSON.parse(JSON.stringify(w).split(from).join(to));
const PERFECT = FIXTURES.find((f) => f.id === "perfect")!;
const BARE = FIXTURES.find((f) => f.id === "nothing-published")!;
const goodWorld = (dom: string) => rename(PERFECT.world, "good.example", dom);

function recorder(worlds: Record<string, World>, delayMs = 0) {
  const names: string[] = [];
  let inflight = new Set<string>(), maxInflight = 0;
  const f: DohFetch = async (name, type): Promise<DohResponse> => {
    names.push(name);
    const dom = Object.keys(worlds).find((d) => name === d || name.endsWith("." + d));
    if (dom) { inflight.add(dom); maxInflight = Math.max(maxInflight, inflight.size); }
    if (delayMs) await sleep(delayMs);
    const r = dom ? await fakeDoh(worlds[dom]).fetch(name, type) : { Status: 0 };
    return r;
  };
  // a domain leaves "in flight" once all its queries finish: tracked by counting per-domain outstanding queries
  return { f, names, get max() { return maxInflight; }, inflight };
}

async function setup(scanOpts: Partial<Parameters<typeof dnsScan>[0]> & { resolver: DohFetch }) {
  const h = makeEnt();
  h.deps.ent!.scan = dnsScan({ resolverSource: SRC, now: () => h.clock.t, ...scanOpts });
  const o = await h.provision("enterprise", "ciso@bigco.com.au", "BigCo", "bigco");
  return { h, o, tid: o.tenant.id };
}

test("estate dns: verified asset gets the real C1 grade, scan time and resolver source", async () => {
  const dom = "bigco.com.au", rec = recorder({ [dom]: goodWorld(dom) });
  const { h, o, tid } = await setup({ resolver: rec.f });
  await h.addVerifiedAsset(o.session, tid, dom, "HQ");
  const est = await h.get(o.session, `/enterprise/${tid}/estate`);
  const row = est.assets[0];
  assert.equal(row.status, "ASSESSED");
  assert.equal(row.grade, "A");
  assert.equal(row.scannedAt, h.clock.t);
  assert.equal(row.resolverSource, SRC);
  assert.match(est.dataSource, /LIVE passive public DNS/);
  assert.doesNotMatch(est.dataSource, /SYNTHETIC/);
  assert.equal(est.totals.assessed, 1);
  assert.equal(est.totals.unknown, 0);
  assert.equal(est.totals.averageScore, row.score);
  assert.ok(rec.names.length > 0);
});

test("estate dns: a resolver that never answers gives UNKNOWN on timeout, never a grade", async () => {
  const hang: DohFetch = () => new Promise(() => {});
  const { h, o, tid } = await setup({ resolver: hang, timeoutMs: 25 });
  await h.addVerifiedAsset(o.session, tid, "slow.bigco.com.au", "slow");
  const t0 = Date.now();
  const est = await h.get(o.session, `/enterprise/${tid}/estate`);
  assert.ok(Date.now() - t0 < 2000, "the per-asset timeout bounded the view");
  const row = est.assets[0];
  assert.equal(row.status, "UNKNOWN");
  assert.equal(row.reason, "timeout");
  assert.equal(row.grade, null);
  assert.equal(row.score, null);
  assert.equal(row.scannedAt, h.clock.t);
  assert.equal(est.totals.unknown, 1);
  assert.equal(est.totals.assessed, 0);
  assert.equal(est.totals.averageScore, null, "UNKNOWN is never averaged in as zero or a pass");
});

test("estate dns: resolver failure (SERVFAIL everywhere, or a throwing resolver) is UNKNOWN, one bad asset does not poison the rest", async () => {
  const good = "good.bigco.com.au", dead = "dead.bigco.com.au", boom = "boom.bigco.com.au";
  const base = recorder({ [good]: goodWorld(good), [dead]: { servfail: ["*"] } });
  const resolver: DohFetch = async (n, t) => { if (n.endsWith(boom)) throw new Error("network down"); return base.f(n, t); };
  const { h, o, tid } = await setup({ resolver });
  for (const d of [good, dead, boom]) await h.addVerifiedAsset(o.session, tid, d, d);
  const est = await h.get(o.session, `/enterprise/${tid}/estate`);
  const by = (d: string) => est.assets.find((x: any) => x.domain === d);
  assert.equal(by(good).status, "ASSESSED");
  for (const d of [dead, boom]) { assert.equal(by(d).status, "UNKNOWN", d); assert.equal(by(d).reason, "resolver_failed", d); assert.equal(by(d).grade, null, d); assert.equal(by(d).score, null, d); }
  assert.equal(est.totals.unknown, 2);
  assert.equal(est.totals.averageScore, by(good).score);
});

test("estate dns: an unverified asset is never queried", async () => {
  const ver = "verified.bigco.com.au", unv = "unproven.bigco.net";
  const rec = recorder({ [ver]: goodWorld(ver), [unv]: goodWorld(unv) });
  const { h, o, tid } = await setup({ resolver: rec.f });
  await h.addVerifiedAsset(o.session, tid, ver, "v");
  await h.post(o.session, `/enterprise/${tid}/assets`, { domain: unv });
  const est = await h.get(o.session, `/enterprise/${tid}/estate`);
  const un = est.assets.find((x: any) => x.domain === unv);
  assert.equal(un.status, "NOT_VERIFIED");
  assert.equal(un.grade, null);
  assert.equal(un.scannedAt, null);
  assert.ok(rec.names.length > 0);
  assert.ok(!rec.names.some((n) => n === unv || n.endsWith("." + unv)), "no DNS query was made for the unverified domain");
  await h.get(o.session, `/enterprise/${tid}/estate.csv`).catch(() => {});
  assert.ok(!rec.names.some((n) => n.endsWith(unv)), "nor via the CSV export");
});

test("estate dns: per-estate concurrency cap is respected (and the pool does run in parallel)", async () => {
  const doms = Array.from({ length: 9 }, (_, i) => `a${i}.bigco.com.au`);
  const worlds: Record<string, World> = {};
  for (const d of doms) worlds[d] = goodWorld(d);
  // count domains with at least one query outstanding
  const out = new Map<string, number>(); let max = 0;
  const resolver: DohFetch = async (name, type) => {
    const d = doms.find((x) => name === x || name.endsWith("." + x))!;
    out.set(d, (out.get(d) ?? 0) + 1); max = Math.max(max, [...out.values()].filter((n) => n > 0).length);
    await sleep(5);
    out.set(d, out.get(d)! - 1);
    return fakeDoh(worlds[d]).fetch(name, type);
  };
  for (const cap of [1, 3]) {
    max = 0; out.clear();
    const { h, o, tid } = await setup({ resolver, concurrency: cap });
    for (const d of doms) await h.addVerifiedAsset(o.session, tid, d, d);
    const est = await h.get(o.session, `/enterprise/${tid}/estate`);
    assert.equal(est.totals.assessed, 9);
    assert.ok(max <= cap, `cap ${cap} but saw ${max} domains in flight`);
    if (cap > 1) assert.ok(max > 1, "pool actually parallelised");
  }
});

test("estate dns: grades match the C1 grader on every shared fixture (UNKNOWN where C1 says ?)", async () => {
  let compared = 0;
  for (const fx of FIXTURES) {
    const c1 = await runScan(fx.domain, fakeDoh(fx.world).fetch);
    const p = dnsScan({ resolver: fakeDoh(fx.world).fetch, resolverSource: SRC });
    const a = await p.assess!(fx.domain);
    if (c1.grade === "?") { assert.equal(a.status, "UNKNOWN", fx.id); continue; }
    assert.equal(a.status, "ASSESSED", fx.id);
    if (a.status !== "ASSESSED") continue;
    assert.equal(a.grade, c1.grade, fx.id);
    assert.equal(a.score, c1.score, fx.id);
    if (fx.grade) assert.equal(a.grade, fx.grade, fx.id);
    // the findings view is a faithful projection of the C1 findings (no check dropped or invented)
    assert.equal(toScanFindings(c1.findings).length, a.counts.critical + a.counts.high + a.counts.medium + a.counts.low, fx.id);
    compared++;
  }
  assert.ok(compared >= 18);
});

test("estate dns: tenant isolation unchanged (B cannot read A's estate; A's view queries only A's domains)", async () => {
  const da = "alpha-canary.com.au", db = "bravo-canary.com.au";
  const rec = recorder({ [da]: goodWorld(da), [db]: rename(BARE.world, "bare.example", db) });
  const { h, o: oa, tid: ta } = await setup({ resolver: rec.f });
  const ob = await h.provision("enterprise", "ciso@other.com.au", "Other", "other");
  await h.addVerifiedAsset(oa.session, ta, da, "CANARY_A");
  await h.addVerifiedAsset(ob.session, ob.tenant.id, db, "CANARY_B");
  rec.names.length = 0;
  const estA = await h.get(oa.session, `/enterprise/${ta}/estate`);
  assert.ok(rec.names.length > 0 && rec.names.every((n) => n.endsWith(da)), "A's view only ever queried A's domain");
  assert.ok(!JSON.stringify(estA).includes(db) && !JSON.stringify(estA).includes("CANARY_B"));
  for (const path of [`/enterprise/${ta}/estate`, `/enterprise/${ta}/estate.csv`]) {
    const r = await h.req("GET", path, { token: ob.session });
    assert.ok(r.status === 403 || r.status === 404, `${path} -> ${r.status}`);
    assert.ok(!(await r.text()).includes("CANARY_A"));
  }
  assert.equal(estA.assets[0].grade, "A");
  assert.notEqual((await h.get(ob.session, `/enterprise/${ob.tenant.id}/estate`)).assets[0].grade, "A");
});

test("estate dns: CSV still neutralises formula injection and carries status, scan time, resolver source", async () => {
  const dom = "csv.bigco.com.au";
  const { h, o, tid } = await setup({ resolver: recorder({ [dom]: goodWorld(dom), "dead.bigco.com.au": { servfail: ["*"] } }).f });
  await h.addVerifiedAsset(o.session, tid, dom, "=HYPERLINK(1)");
  await h.addVerifiedAsset(o.session, tid, "dead.bigco.com.au", "@SUM(A1)");
  const csv = await (await h.req("GET", `/enterprise/${tid}/estate.csv`, { token: o.session })).text();
  const lines = csv.split("\n");
  assert.match(lines[0], /status,grade,score,.*scanned_at,resolver_source$/);
  assert.match(csv, /,'=HYPERLINK\(1\),/);
  assert.match(csv, /,'@SUM\(A1\),/);
  const dead = lines.find((l) => l.startsWith("dead.bigco.com.au"))!;
  assert.match(dead, /,UNKNOWN,,,0,0,0,0,/, "UNKNOWN row has an empty grade and score");
  const good = lines.find((l) => l.startsWith(dom))!;
  assert.match(good, new RegExp(`,ASSESSED,A,\\d+,.*,${new Date(h.clock.t).toISOString()},${SRC}$`));
  for (const l of lines.filter((x) => x && !x.startsWith("#") && x !== lines[0])) assert.doesNotMatch(l, /(^|,)[=+\-@]/, "no cell starts with a formula character");
});

test("estate dns: the provider is passive (resolver-only I/O) and survives hostile domain strings as UNKNOWN", async () => {
  const names: string[] = [];
  const p = dnsScan({ resolver: async (n) => { names.push(n); return { Status: 0 }; }, resolverSource: SRC });
  const a = await p.assess!("not a domain; rm -rf /");
  assert.equal(a.status, "UNKNOWN");
  assert.equal(names.length, 0, "an invalid name never reaches the resolver");
});
