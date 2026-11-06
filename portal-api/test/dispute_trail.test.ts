// f103: dispute case writes are anchored through the market service. SYNTHETIC fixtures only (mock payments, in-memory stores, FakeD1 for the D1 anchor adapter).
// Mutants: `node test/mutate_dispute_trail.mjs` (reruns this file per mutant; not part of npm test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { rig } from "./market_harness.ts";
import { MemoryDisputeCaseStore, commit, TrailError, type DisputeTrail } from "../src/market/dispute_trail.ts";
import { MemoryAnchorStore, D1AnchorStore, type AnchorStore, type Anchor } from "../src/market/audit_anchor.ts";
import { FakeD1 } from "./fake_d1.ts";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const rewrite = (c: any, idx: number, patch: object) => {   // attacker with write access to the case: edit, then recompute every hash
  const x = structuredClone(c); Object.assign(x.audit[idx], patch); let prev = "0".repeat(64);
  for (const e of x.audit) { e.prev = prev; e.hash = sha(JSON.stringify([e.seq, e.eventId, e.kind, e.from, e.to, e.at, e.actor, e.detail, e.payloadHash, e.prev])); prev = e.hash; }
  return x;
};
class FlakyAnchors implements AnchorStore {
  failNext = 0; inner: AnchorStore; constructor(inner: AnchorStore) { this.inner = inner; }
  async append(a: Anchor) { if (this.failNext > 0) { this.failNext--; throw new Error("anchor store down"); } return this.inner.append(a); }
  listFails = false;
  async list(j: string) { if (this.listFails) throw new Error("anchor store unreadable"); return this.inner.list(j); }
}
const adapters: [string, () => AnchorStore][] = [
  ["memory", () => new MemoryAnchorStore()],
  ["d1 (FakeD1)", () => { const d1 = new FakeD1({ fk: false }); d1.db.exec(readFileSync(fileURLToPath(new URL("../migrations/0006_audit_anchor.sql", import.meta.url)), "utf8")); return new D1AnchorStore(d1); }],
];

async function setup(mk: () => AnchorStore, tag = "a") {
  const r = rig(); const flaky = new FlakyAnchors(mk()); const cases = new MemoryDisputeCaseStore();
  const trail: DisputeTrail = { cases, anchors: flaky }; r.h.deps.market!.disputes = trail;
  const o = await r.owner(`o@${tag}.com.au`, `${tag}.com.au`); const p = await r.pro(`p@${tag}.com`);
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id); await r.deliver(p.session, id).then((x) => x.text());
  const audit = (s: string, jid = id) => r.h.req("GET", `/market/jobs/${jid}/dispute/audit`, { token: s });
  const open = (s: string, reason = "pro disappeared after claiming") => r.h.req("POST", `/market/jobs/${id}/dispute`, { token: s, body: { reason } });
  const evidence = (s: string, note: string, eventId?: string) => r.h.req("POST", `/market/jobs/${id}/dispute/evidence`, { token: s, body: { note, eventId } });
  const resolveOpenCard = async (outcome: string) => { const c = (await r.store.openCards())[0]; return r.internal("POST", `/internal/market/cards/${c.id}/resolve`, { outcome }); };
  return { r, o, p, id, flaky, cases, trail, audit, open, evidence, resolveOpenCard };
}

for (const [name, mk] of adapters) {
  test(`[${name}] normal lifecycle anchors every head: open, evidence x2, resolve; route reports verified with no unanchored tail`, async () => {
    const s = await setup(mk, "life");
    assert.equal((await s.open(s.o.session)).status, 200);
    assert.deepEqual((await s.r.h.j(await s.audit(s.o.session))).verdict, { ok: true, anchoredThrough: 1, unanchoredTail: 0 });
    assert.equal((await s.evidence(s.p.session, "SYNTHETIC: pro log shows the change")).status, 200);
    assert.equal((await s.evidence(s.o.session, "SYNTHETIC: owner screenshot")).status, 200);
    assert.deepEqual((await s.r.h.j(await s.audit(s.o.session))).verdict, { ok: true, anchoredThrough: 3, unanchoredTail: 0 });
    assert.equal((await s.resolveOpenCard("refund_owner")).status, 200);
    const rep = await s.r.h.j(await s.audit(s.p.session));   // the pro is a party too
    assert.equal(rep.state, "RESOLVED_REFUNDED"); assert.equal(rep.entries, 4);
    assert.deepEqual(rep.verdict, { ok: true, anchoredThrough: 4, unanchoredTail: 0 });
    assert.equal((await s.flaky.list(s.id)).length, 4, "exactly one anchor per audit entry");
  });

  test(`[${name}] resolve straight from OPEN anchors both the reviewer note and the resolution; resume keeps one chain across a second dispute`, async () => {
    const s = await setup(mk, "res");
    await s.open(s.o.session); assert.equal((await s.resolveOpenCard("resume")).status, 200);
    assert.equal((await s.r.store.getJob(s.id))!.status, "delivered");
    await s.open(s.o.session, "still not fixed after resume");   // second dispute, same chain
    assert.equal((await s.resolveOpenCard("refund_owner")).status, 200);
    const rep = await s.r.h.j(await s.audit(s.o.session));
    assert.equal(rep.state, "RESOLVED_REFUNDED"); assert.equal(rep.verdict.ok, true); assert.equal(rep.verdict.unanchoredTail, 0);
    assert.equal(rep.entries, (await s.flaky.list(s.id)).length);
  });

  test(`[${name}] tampered case (edit one entry and recompute every hash) is reported as head_mismatch by the route`, async () => {
    const s = await setup(mk, "tam");
    await s.open(s.o.session); await s.evidence(s.p.session, "SYNTHETIC: honest evidence"); await s.resolveOpenCard("refund_owner");
    assert.equal((await s.r.h.j(await s.audit(s.o.session))).verdict.ok, true);
    const c = (await s.cases.get(s.id))!; assert.equal((await import("../src/market/dispute.ts")).verifyAudit(c), null);
    const forged = rewrite(c, 1, { detail: "SYNTHETIC: forged evidence note", actor: "attacker" });
    assert.equal((await import("../src/market/dispute.ts")).verifyAudit(forged), null, "the forgery is internally consistent: verifyAudit alone is blind");
    await s.cases.put(forged);
    const rep = await s.r.h.j(await s.audit(s.o.session));
    assert.deepEqual(rep.verdict, { ok: false, reason: "head_mismatch", seq: 2 });
  });

  test(`[${name}] truncated case and a case with no anchors are never reported verified`, async () => {
    const s = await setup(mk, "trn");
    await s.open(s.o.session); await s.evidence(s.p.session, "SYNTHETIC: e1"); await s.evidence(s.o.session, "SYNTHETIC: e2");
    const c = (await s.cases.get(s.id))!; c.audit.pop(); await s.cases.put(c);
    assert.deepEqual((await s.r.h.j(await s.audit(s.o.session))).verdict, { ok: false, reason: "truncated", seq: 3 });
    // an unanchored case: written straight to the case store behind the service's back
    const s2 = await setup(mk, "una"); await s2.open(s2.o.session);
    const trail2 = s2.r.h.deps.market!.disputes!; trail2.anchors = mk();
    assert.deepEqual((await s2.r.h.j(await s2.audit(s2.o.session))).verdict, { ok: false, reason: "unanchored" });
  });

  test(`[${name}] anchor failure on OPEN rolls back: no case, job still claimable state, no card, nothing acknowledged`, async () => {
    const s = await setup(mk, "fo");
    const before = (await s.r.store.getJob(s.id))!.status;
    s.flaky.failNext = 1;
    const res = await s.open(s.o.session); assert.equal(res.status, 503);
    assert.equal((await s.r.store.getJob(s.id))!.status, before, "job write undone");
    assert.equal(await s.cases.get(s.id), undefined, "case write undone");
    assert.equal((await s.r.store.openCards()).length, 0, "no dispute card raised");
    assert.equal((await s.flaky.list(s.id)).length, 0);
    assert.equal((await s.open(s.o.session)).status, 200, "a retry after the store recovers succeeds");
  });

  test(`[${name}] anchor failure on EVIDENCE rolls back to the last anchored case; retry works`, async () => {
    const s = await setup(mk, "fe");
    await s.open(s.o.session); s.flaky.failNext = 1;
    assert.equal((await s.evidence(s.p.session, "SYNTHETIC: lost evidence", "ev_fixed")).status, 503);
    const c = (await s.cases.get(s.id))!; assert.equal(c.audit.length, 1); assert.equal(c.evidence.length, 0);
    assert.deepEqual((await s.r.h.j(await s.audit(s.o.session))).verdict, { ok: true, anchoredThrough: 1, unanchoredTail: 0 });
    assert.equal((await s.evidence(s.p.session, "SYNTHETIC: lost evidence", "ev_fixed")).status, 200);
    assert.equal((await s.cases.get(s.id))!.audit.length, 2);
  });

  test(`[${name}] anchor failure on RESOLVE: no refund, dispute and card stay open; partial two-step commit rolls back to the anchored note`, async () => {
    const s = await setup(mk, "fr");
    await s.open(s.o.session);
    s.flaky.failNext = 1;   // resolve from OPEN = note (anchor 2) + resolution (anchor 3); fail the FIRST
    assert.equal((await s.resolveOpenCard("refund_owner")).status, 503);
    assert.equal((await s.r.store.getJob(s.id))!.status, "disputed"); assert.equal(s.r.payments.count("refund"), 0);
    assert.equal((await s.r.store.openCards()).length, 1, "card still open");
    assert.equal((await s.cases.get(s.id))!.audit.length, 1);
    // now fail the SECOND anchor of the two-step commit: the first (reviewer note) stays anchored and kept; case never ahead of its anchors
    const orig = s.flaky.append.bind(s.flaky); let n = 0; s.flaky.append = async (a: Anchor) => { if (++n === 2) throw new Error("down"); return orig(a); };
    assert.equal((await s.resolveOpenCard("refund_owner")).status, 503);
    assert.equal((await s.r.store.getJob(s.id))!.status, "disputed"); assert.equal(s.r.payments.count("refund"), 0);
    const c = (await s.cases.get(s.id))!; assert.equal(c.audit.length, 2, "rolled back to the last anchored state");
    assert.deepEqual((await s.r.h.j(await s.audit(s.o.session))).verdict, { ok: true, anchoredThrough: 2, unanchoredTail: 0 });
    s.flaky.append = orig;
    assert.equal((await s.resolveOpenCard("refund_owner")).status, 200);
    assert.deepEqual((await s.r.h.j(await s.audit(s.o.session))).verdict, { ok: true, anchoredThrough: 3, unanchoredTail: 0 });
    assert.equal(s.r.payments.count("refund"), 1);
  });

  test(`[${name}] cross-tenant: a stranger gets 404 (never 403) on the audit and evidence routes, same body as a missing job; unauthenticated gets 401`, async () => {
    const s = await setup(mk, "xt");
    await s.open(s.o.session);
    const stranger = await s.r.h.login("stranger@other.com");
    const miss = await s.audit(stranger.session, "job_does_not_exist");
    for (const res of [await s.audit(stranger.session), await s.evidence(stranger.session, "SYNTHETIC: planted evidence")]) assert.equal(res.status, 404);
    assert.equal((await s.audit(stranger.session)).status, miss.status);
    assert.deepEqual(await (await s.audit(stranger.session)).json(), await miss.json());
    assert.equal((await s.cases.get(s.id))!.audit.length, 1, "stranger evidence was not recorded");
    assert.equal((await s.r.h.req("GET", `/market/jobs/${s.id}/dispute/audit`, {})).status, 401);
    // a third pro who never claimed is also a stranger
    const p2 = await s.r.pro("p2@x.com"); assert.equal((await s.audit(p2.session)).status, 404);
  });

  test(`[${name}] evidence needs a live dispute and a real note; audit on a job with no dispute is 404; replay of one eventId is one entry`, async () => {
    const s = await setup(mk, "ev");
    assert.equal((await s.evidence(s.o.session, "SYNTHETIC: too early")).status, 409);
    assert.equal((await s.audit(s.o.session)).status, 404, "no case yet");
    await s.open(s.o.session);
    assert.equal((await s.evidence(s.o.session, "x")).status, 400);
    await s.evidence(s.o.session, "SYNTHETIC: same", "ev_same"); await s.evidence(s.o.session, "SYNTHETIC: same", "ev_same");
    assert.equal((await s.cases.get(s.id))!.audit.length, 2); assert.equal((await s.flaky.list(s.id)).length, 2);
    assert.equal((await s.evidence(s.o.session, "SYNTHETIC: different payload", "ev_same")).status, 409, "event id reuse with a different payload is refused");
  });
  test(`[${name}] an anchor store that REFUSES (conflicting pre-seeded head) fails closed like one that throws; an unreadable store is never "verified"`, async () => {
    const s = await setup(mk, "rf");
    assert.deepEqual(await s.flaky.append({ jobId: s.id, seq: 1, head: "f".repeat(64), at: 1 }), { ok: true, replay: false });   // a bogus head already anchored at seq 1
    assert.equal((await s.open(s.o.session)).status, 503, "anchorCase returned ok:false, not a throw");
    assert.equal(await s.cases.get(s.id), undefined); assert.equal((await s.r.store.openCards()).length, 0);
    assert.equal((await s.r.store.getJob(s.id))!.status, "delivered", "job write undone");
    const s2 = await setup(mk, "ul"); await s2.open(s2.o.session); s2.flaky.listFails = true;
    const res = await s2.audit(s2.o.session); const body = await res.json() as any;
    assert.notEqual(body.verdict?.ok, true, "an unreadable anchor store must not yield a verified verdict");
  });

  test(`[${name}] commit() itself: non-store errors surface as TrailError; open over an existing case is refused and leaves the case intact`, async () => {
    const t: DisputeTrail = { cases: new MemoryDisputeCaseStore(), anchors: new FlakyAnchors(mk()) };
    const open = { open: { jobId: "job_syn_c", amountCents: 9_900, at: 1, actor: "syn", eventId: "o1", reason: "SYNTHETIC reason" } };
    await commit(t, "job_syn_c", [open], 2);
    await assert.rejects(commit(t, "job_syn_c", [open], 3), (e: any) => e instanceof TrailError && e.reason === "case_exists");
    (t.anchors as FlakyAnchors).failNext = 1;
    await assert.rejects(commit(t, "job_syn_c", [{ event: { eventId: "e1", kind: "SUBMIT_EVIDENCE", at: 4, actor: "syn", detail: "SYNTHETIC note" } }], 4), (e: any) => e instanceof TrailError && e.reason.startsWith("anchor_failed"));
    assert.equal((await t.cases.get("job_syn_c"))!.audit.length, 1);
  });
}

test("default deps: with no injected trail the service falls back to in-memory stores (the existing market suite runs unchanged)", async () => {
  const r = rig(); assert.equal(r.h.deps.market!.disputes, undefined);
  const o = await r.owner("o@df.com.au", "df.com.au"); const p = await r.pro("p@df.com");
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id);
  assert.equal((await r.h.req("POST", `/market/jobs/${id}/dispute`, { token: o.session, body: { reason: "pro disappeared again" } })).status, 200);
  assert.ok(r.h.deps.market!.disputes, "memory trail created lazily");
  assert.equal((await r.h.j(await r.h.req("GET", `/market/jobs/${id}/dispute/audit`, { token: p.session }))).verdict.ok, true);
});
