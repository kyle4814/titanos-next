import { test } from "node:test";
import assert from "node:assert/strict";
import { make } from "./harness.ts";
import { MemoryZone } from "../src/owner/dnsw.ts";
import { MemoryOwnerStore } from "../src/owner/engine.ts";
import { runMonitor } from "../src/owner/service.ts";
import { healthy } from "./owner_harness.ts";

async function rigHttp(domain = "acme.com.au") {
  const h = make();
  const zone = new MemoryZone(healthy(domain));
  zone.world.txt![domain] = ["v=spf1 include:_spf.google.com ~all"];
  h.deps.owner = { store: new MemoryOwnerStore(), doh: () => zone.doh, zones: { zoneFor: (x) => (x === domain ? zone : undefined) } };
  const me = await h.login("owner@acme.com.au");
  const { d } = await h.verifiedDomain(me.session, domain);
  return { h, zone, me, id: d.id as string, domain };
}
test("http: overview, scan, one-tap auto-fix, undo, report; sessions required", async () => {
  const { h, zone, me, id } = await rigHttp();
  assert.equal((await h.req("GET", `/app/domains/${id}`)).status, 401);
  const list = await h.j(await h.req("GET", "/app/domains", { token: me.session }));
  assert.equal(list.domains[0].level, 1);
  const sc = await h.j(await h.req("POST", `/app/domains/${id}/scan`, { token: me.session }));
  assert.equal(sc.quests.open[0].check, "SPF"); assert.equal(sc.level, 4, "SPF soft-fail caps the domain at L4");
  const f = await h.j(await h.req("POST", `/app/domains/${id}/fix`, { token: me.session, body: { check: "SPF" } }));
  assert.equal(f.result, "proven"); assert.equal(f.overview.level, 9); assert.equal(f.overview.badge.level, 9);
  assert.deepEqual(zone.world.txt!["acme.com.au"], ["v=spf1 include:_spf.google.com -all"]);
  const rep = await (await h.req("GET", `/app/domains/${id}/report?format=md`, { token: me.session })).text();
  assert.match(rep, /SPF: PROVEN_FIXED/); assert.doesNotMatch(rep, /[–—]/);
  const u = await h.j(await h.req("POST", `/app/domains/${id}/fixes/${f.fixId}/undo`, { token: me.session }));
  assert.equal(u.findings.find((x: any) => x.check === "SPF").state, "REGRESSED");
  assert.equal((await h.req("POST", `/app/domains/${id}/fixes/${f.fixId}/undo`, { token: me.session })).status, 409);
});
test("http: manual scans are rate limited to one a minute per domain", async () => {
  const { h, me, id } = await rigHttp();
  assert.equal((await h.req("POST", `/app/domains/${id}/scan`, { token: me.session })).status, 200);
  assert.equal((await h.req("POST", `/app/domains/${id}/scan`, { token: me.session })).status, 429);
  h.clock.t += 61_000; assert.equal((await h.req("POST", `/app/domains/${id}/scan`, { token: me.session })).status, 200);
});
test("http: tenant isolation: another account gets 404 on every owner route and no zone write ever happens", async () => {
  const { h, zone, id } = await rigHttp();
  const other = await h.login("intruder@evil.com.au");
  for (const [m, p, b] of [["GET", `/app/domains/${id}`], ["POST", `/app/domains/${id}/scan`], ["POST", `/app/domains/${id}/fix`, { check: "SPF" }], ["POST", `/app/domains/${id}/fixes/fix_1/undo`], ["GET", `/app/domains/${id}/report`]] as const) {
    const r = await h.req(m, p, { token: other.session, body: b });
    assert.equal(r.status, 404, `${m} ${p}`);
  }
  assert.equal(zone.writes.length, 0);
  assert.equal((await h.j(await h.req("GET", "/app/domains", { token: other.session }))).domains.length, 0);
});
test("http: unverified domains have no owner seat (403); bad input is 400", async () => {
  const { h, me } = await rigHttp();
  const d = await h.j(await h.req("POST", "/domains", { token: me.session, body: { domain: "unproven.com.au" } }));
  assert.equal((await h.req("GET", `/app/domains/${d.id}`, { token: me.session })).status, 403);
  const { id } = await rigHttp();
  void id;
  const r = await h.req("POST", `/app/domains/${d.id}/fix`, { token: me.session, body: { check: "../etc" } });
  assert.equal(r.status, 400);
});
test("http: guided faults are refused politely, never guessed; the response carries the reason", async () => {
  const { h, zone, me, id, domain } = await rigHttp();
  delete zone.world.txt![`google._domainkey.${domain}`];
  await h.req("POST", `/app/domains/${id}/scan`, { token: me.session });
  const f = await h.j(await h.req("POST", `/app/domains/${id}/fix`, { token: me.session, body: { check: "DKIM" } }));
  assert.equal(f.result, "guided"); assert.match(f.detail, /mail provider/);
  assert.equal(zone.writes.length, 0);
});
test("monitor entitlement: scheduled scans start only with a paid monitor subscription for that domain; fault return mails the owner", async () => {
  const { h, zone, me, id, domain } = await rigHttp();
  await h.req("POST", `/app/domains/${id}/fix`, { token: me.session, body: { check: "SPF" } }).catch(() => {});
  await h.req("POST", `/app/domains/${id}/scan`, { token: me.session });
  await h.req("POST", `/app/domains/${id}/fix`, { token: me.session, body: { check: "SPF" } });
  assert.equal((await h.j(await h.req("GET", `/app/domains/${id}`, { token: me.session }))).monitor.active, false, "free tier: no scheduled monitor");
  await h.req("POST", "/checkout", { token: me.session, body: { product: "monitor_monthly", domain } });
  await h.pay("monitor_monthly");
  const ov = await h.j(await h.req("GET", `/app/domains/${id}`, { token: me.session }));
  assert.equal(ov.monitor.active, true);
  zone.world.txt![domain] = ["v=spf1 include:_spf.google.com ~all"]; // the fault returns
  h.clock.t += 86_400_000 + 1000;
  h.mailer.outbox.length = 0;
  const t = await runMonitor(h.deps);
  assert.equal(t.scanned, 1);
  const mail = h.mailer.outbox.find((m) => m.to === "owner@acme.com.au")!;
  assert.match(mail.subject, /fault returned|has returned/); assert.doesNotMatch(mail.text, /[–—]/);
  const after = await h.j(await h.req("GET", `/app/domains/${id}`, { token: me.session }));
  assert.equal(after.findings.find((x: any) => x.check === "SPF").state, "REGRESSED"); assert.ok(after.badge === null || after.badge.level < 9);
});
test("http: without owner deps every owner route fails closed (503), never a half answer", async () => {
  const h = make(); const me = await h.login("x@y.com.au");
  assert.equal((await h.req("GET", "/app/domains", { token: me.session })).status, 503);
});
