// f187: durable dispute case store. SYNTHETIC fixtures only (example jobs, fake amounts, in-memory maps, FakeD1 on node:sqlite; no live D1).
// One contract suite runs on both adapters. Mutants: `node test/mutate_dispute_case_store.mjs` (reruns this file per mutant; not part of npm test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { rig } from "./market_harness.ts";
import { FakeD1 } from "./fake_d1.ts";
import { apply, openDispute, verifyAudit, type DisputeCase } from "../src/market/dispute.ts";
import { commit, report, TrailError, type DisputeTrail } from "../src/market/dispute_trail.ts";
import { MemoryAnchorStore, D1AnchorStore, verifyAnchored, type AnchorStore, type Anchor } from "../src/market/audit_anchor.ts";
import { D1DisputeCaseStore, MemoryTenantCaseStore, CaseConflict, CaseRowCorrupt, type TenantOf } from "../src/market/dispute_case_store.ts";
import type { DisputeCaseStore } from "../src/market/dispute_trail.ts";

const T0 = 1_800_000_000_000;   // SYNTHETIC epoch
const mig = (f: string) => readFileSync(fileURLToPath(new URL(`../migrations/${f}`, import.meta.url)), "utf8");
const newDb = () => { const d = new FakeD1(); /* restack f350: int-head FakeD1 applies every migration, 0006_audit_anchor and 0007_dispute_case included */ return d; };
const tenants = (m: Record<string, string>): TenantOf => (j) => m[j];
const ownerA = tenants({ job_a: "tenant_a", job_b: "tenant_b", job_x: "tenant_a" });

// A backing database that outlives the store instances (a "restart" builds new instances over it).
interface Backing { store(t?: TenantOf): DisputeCaseStore; anchors(): AnchorStore; corrupt(tenant: string, job: string, patch: "head" | "len" | "state" | "json"): void; rows(): number; log?: FakeD1["log"]; db?: FakeD1 }
const adapters: [string, () => Backing][] = [
  ["memory", () => {
    const rows = new Map<string, any>(); const anchors = new MemoryAnchorStore();
    return { store: (t = ownerA) => new MemoryTenantCaseStore(t, rows), anchors: () => anchors, rows: () => rows.size,
      corrupt: (tn, j, p) => { const r = rows.get(`${tn}\u0000${j}`); if (p === "head") r.head = "f".repeat(64); if (p === "len") r.len = 99; if (p === "state") r.state = "CLAWBACK"; if (p === "json") r.json = r.json.replace("OPEN", "OPEM"); } };
  }],
  ["d1 (FakeD1)", () => {
    const d = newDb();
    const col = { head: "head = '" + "f".repeat(64) + "'", len: "audit_len = 99", state: "state = 'CLAWBACK'", json: "case_json = replace(case_json, 'job_', 'jab_')" };
    return { store: (t = ownerA) => new D1DisputeCaseStore(d, t), anchors: () => new D1AnchorStore(d), rows: () => Number((d.db.prepare("SELECT COUNT(*) n FROM dispute_case").get() as any).n), log: d.log, db: d,
      corrupt: (tn, j, p) => { d.db.exec(`UPDATE dispute_case SET ${col[p]} WHERE tenant_id='${tn}' AND job_id='${j}'`); } };
  }],
];
const open = (job: string, n = 0): DisputeCase => openDispute({ jobId: job, amountCents: 15_000, at: T0 + n, actor: "owner_syn", eventId: `o_${job}`, reason: "SYNTHETIC: not as described", synthetic: true });
const evt = (c: DisputeCase, n: number) => { const r = apply(c, { eventId: `e${n}`, kind: "SUBMIT_EVIDENCE", at: T0 + n, actor: "syn", detail: "SYNTHETIC: screenshot" }); assert.equal(r.ok, true); return (r as { case: DisputeCase }).case; };
import { createHash } from "node:crypto";
const rewriteAll = (c: any, idx: number, detail: string) => { const x = structuredClone(c); x.audit[idx].detail = detail; let prev = "0".repeat(64);
  for (const e of x.audit) { e.prev = prev; e.hash = createHash("sha256").update(JSON.stringify([e.seq, e.eventId, e.kind, e.from, e.to, e.at, e.actor, e.detail, e.payloadHash, e.prev])).digest("hex"); prev = e.hash; } return x; };
const trailOf = (b: Backing, t?: TenantOf): DisputeTrail => ({ cases: b.store(t), anchors: b.anchors() });

for (const [name, mk] of adapters) {
  test(`[${name}] contract: absent reads undefined; commit stores the case; a second store over the same backing reads it back with an intact chain`, async () => {
    const b = mk(); const s = b.store();
    assert.equal(await s.get("job_a"), undefined);
    const c = await commit({ cases: s, anchors: b.anchors() }, "job_a", [{ open: { jobId: "job_a", amountCents: 15_000, at: T0, actor: "o", eventId: "o1", reason: "SYNTHETIC: not as described" } }], T0);
    const back = (await b.store().get("job_a"))!;
    assert.deepEqual(back, c); assert.equal(verifyAudit(back), null); assert.equal(back.audit.length, 1);
  });

  test(`[${name}] contract: chain appends are one CAS write; the new head replaces the old and the anchors follow`, async () => {
    const b = mk(); const t = trailOf(b);
    await commit(t, "job_a", [{ open: { jobId: "job_a", amountCents: 15_000, at: T0, actor: "o", eventId: "o1", reason: "SYNTHETIC: x" } }], T0);
    const c = await commit(t, "job_a", [{ event: { eventId: "e1", kind: "SUBMIT_EVIDENCE", at: T0 + 1, actor: "p", detail: "SYNTHETIC: log" } }, { event: { eventId: "e2", kind: "RESOLVE_REFUND", at: T0 + 2, actor: "r", detail: "refund" } }], T0 + 2);
    assert.equal(c.audit.length, 3);
    const back = (await b.store().get("job_a"))!; assert.deepEqual(back.audit.map((e) => e.hash), c.audit.map((e) => e.hash)); assert.equal(back.state, "RESOLVED_REFUNDED");
    assert.deepEqual(await verifyAnchored(b.anchors(), back), { ok: true, anchoredThrough: 3, unanchoredTail: 0 });
    assert.equal(b.rows(), 1, "one row per case, never one per entry");
  });

  test(`[${name}] contract: a write with no prior read is refused (never blind), and writes for an unknown tenant are refused`, async () => {
    const b = mk();
    await assert.rejects(b.store().put(open("job_a")), (e: any) => e instanceof TrailError && e.reason === "case_unread");
    const s = b.store(tenants({})); assert.equal(await s.get("job_a"), undefined);
    await assert.rejects(s.put(open("job_a")), (e: any) => e instanceof TrailError && e.reason === "case_tenant_unknown");
    assert.equal(b.rows(), 0);
    const s2 = b.store(); await s2.get("job_a");
    await assert.rejects(s2.put({ ...open("job_a"), audit: [] }), (e: any) => e.reason === "case_chain_empty"); assert.equal(b.rows(), 0);
  });

  test(`[${name}] CAS: of two writers that read the same head only the first wins; the loser gets case_conflict and changes nothing`, async () => {
    const b = mk(); const s0 = b.store(); await s0.get("job_a"); await s0.put(open("job_a"));
    const A = b.store(), B = b.store(); const ca = (await A.get("job_a"))!; await B.get("job_a");
    await A.put(evt(ca, 1));
    await assert.rejects(B.put(evt(ca, 2)), (e: any) => e instanceof CaseConflict && e.reason === "case_conflict");
    const now = (await b.store().get("job_a"))!; assert.equal(now.audit.length, 2); assert.equal(now.audit[1].eventId, "e1", "the loser's event is not in the chain");
  });

  test(`[${name}] CAS: two writers that both read "absent" cannot both create the case`, async () => {
    const b = mk(); const A = b.store(), B = b.store(); await A.get("job_a"); await B.get("job_a");
    await A.put(open("job_a", 0));
    await assert.rejects(B.put(open("job_a", 5)), CaseConflict);
    assert.equal((await b.store().get("job_a"))!.openedAt, T0);
  });

  test(`[${name}] CAS: delete needs the head it last saw, and a stale delete loses`, async () => {
    const b = mk(); const s = b.store(); await s.get("job_a"); await s.put(open("job_a"));
    const A = b.store(), B = b.store(); const ca = (await A.get("job_a"))!; await B.get("job_a");
    await A.put(evt(ca, 1));
    await assert.rejects(B.delete("job_a"), CaseConflict);
    assert.equal((await b.store().get("job_a"))!.audit.length, 2);
    await A.delete("job_a"); assert.equal(await b.store().get("job_a"), undefined);
    await A.delete("job_a");   // deleting an absent case is a no-op
  });

  test(`[${name}] cross-tenant: tenant B can neither read nor change tenant A's case; the same job id under another tenant is a separate row`, async () => {
    const b = mk(); const a = b.store(); await a.get("job_a"); await a.put(open("job_a"));
    const forged = tenants({ job_a: "tenant_b" });   // a caller claiming the job belongs to B
    const sb = b.store(forged); assert.equal(await sb.get("job_a"), undefined, "B sees nothing of A's case");
    await sb.put(open("job_a", 9));   // B creates ITS OWN case under the same job id; A's row is untouched
    assert.equal(b.rows(), 2);
    assert.equal((await b.store().get("job_a"))!.openedAt, T0, "A's case unchanged");
    const sb2 = b.store(forged); await sb2.get("job_a"); await sb2.delete("job_a");
    assert.equal((await b.store().get("job_a"))!.audit.length, 1, "B's delete never touches A's row");
    assert.equal(b.rows(), 1);
  });

  for (const p of ["head", "len", "state", "json"] as const) test(`[${name}] fail closed: a row whose ${p} disagrees with its chain is not returned`, async () => {
    const b = mk(); const s = b.store(); await s.get("job_a"); await s.put(open("job_a"));
    b.corrupt("tenant_a", "job_a", p);
    await assert.rejects(b.store().get("job_a"), (e: any) => e instanceof CaseRowCorrupt || e instanceof SyntaxError);
    if (p !== "json") await assert.rejects(b.store().get("job_a"), CaseRowCorrupt);
  });

  test(`[${name}] anchor failure restores the last anchored case through the store (CAS restore), and the case row never keeps the unanchored head`, async () => {
    const b = mk(); const real = b.anchors(); let fail = 0;
    const flaky: AnchorStore = { append: async (a: Anchor) => { if (fail-- > 0) throw new Error("anchor store down"); return real.append(a); }, list: (j) => real.list(j) };
    const t: DisputeTrail = { cases: b.store(), anchors: flaky };
    await commit(t, "job_a", [{ open: { jobId: "job_a", amountCents: 15_000, at: T0, actor: "o", eventId: "o1", reason: "SYNTHETIC: x" } }], T0);
    fail = 1;
    await assert.rejects(commit(t, "job_a", [{ event: { eventId: "e1", kind: "SUBMIT_EVIDENCE", at: T0 + 1, actor: "p", detail: "SYNTHETIC: y" } }], T0 + 1));
    const now = (await b.store().get("job_a"))!; assert.equal(now.audit.length, 1);
    fail = 1; await assert.rejects(commit(trailOf(b), "job_x", [{ event: { eventId: "e9", kind: "SUBMIT_EVIDENCE", at: T0, actor: "p" } }], T0), (e: any) => e.reason === "no_case");
    // a first-ever open whose anchor fails leaves no case at all
    await assert.rejects(commit({ cases: b.store(), anchors: { ...flaky, append: async () => { throw new Error("down"); } } }, "job_b", [{ open: { jobId: "job_b", amountCents: 1, at: T0, actor: "o", eventId: "o2", reason: "SYNTHETIC: z" } }], T0));
    assert.equal(await b.store().get("job_b"), undefined);
  });
}

// ---- D1-only: SQL shape and migration ----
test("D1: every statement against dispute_case carries tenant_id AND job_id in its WHERE (or VALUES for the insert)", async () => {
  const b = adapters[1][1](); const t = trailOf(b);
  await commit(t, "job_a", [{ open: { jobId: "job_a", amountCents: 1, at: T0, actor: "o", eventId: "o1", reason: "SYNTHETIC: x" } }], T0);
  await commit(t, "job_a", [{ event: { eventId: "e1", kind: "SUBMIT_EVIDENCE", at: T0 + 1, actor: "p", detail: "SYNTHETIC: y" } }], T0 + 1);
  await b.store().get("job_a"); const s = b.store(); await s.get("job_a"); await s.delete("job_a");
  const q = b.log!.filter((l) => /dispute_case/.test(l.sql)); assert.ok(q.length >= 5);
  for (const l of q) {
    if (/^INSERT/i.test(l.sql)) { assert.match(l.sql, /\(tenant_id, job_id,/); continue; }
    assert.match(l.sql, /WHERE tenant_id = \? AND job_id = \?/, l.sql);
  }
  for (const l of q.filter((x) => /^(UPDATE|DELETE)/i.test(x.sql))) assert.match(l.sql, /AND head = \?/, "writes are CAS-guarded: " + l.sql);
});
test("D1: migration 0007 constrains the table (state CHECK, 64-hex head length, identity frozen) and is additive (CREATE ... IF NOT EXISTS only)", () => {
  const sql = mig("0007_dispute_case.sql");
  assert.ok(!/\b(DROP|ALTER|DELETE FROM|UPDATE)\b\s/i.test(sql.replace(/--.*$/gm, "").replace(/BEFORE UPDATE OF/g, "")), "no destructive DDL");
  const b = adapters[1][1](); const db = b.db!.db;
  const ins = (state: string, head: string, len = 1, tenant = "t") => db.prepare("INSERT INTO dispute_case VALUES (?,?,?,?,?,?,?)").run(tenant, "j", state, head, len, "{}", 1);
  assert.throws(() => ins("BOGUS", "a".repeat(64)), /CHECK/); assert.throws(() => ins("OPEN", "short"), /CHECK/); assert.throws(() => ins("OPEN", "a".repeat(64), 0), /CHECK/); assert.throws(() => ins("OPEN", "a".repeat(64), 1, ""), /CHECK/);
  ins("OPEN", "a".repeat(64));
  assert.throws(() => db.exec("UPDATE dispute_case SET tenant_id = 'other'"), /dispute_case_identity_fixed/);
  assert.throws(() => db.exec("UPDATE dispute_case SET job_id = 'other'"), /dispute_case_identity_fixed/);
});

// ---- service level: restart and cross-tenant over the real routes ----
async function svc(tag: string) {
  const r = rig(); const b = adapters[1][1]();
  const tenantOf: TenantOf = async (id) => (await r.store.getJob(id))?.ownerAccountId;
  const wire = () => { r.h.deps.market!.disputes = { cases: new D1DisputeCaseStore(b.db!, tenantOf), anchors: new D1AnchorStore(b.db!) }; };
  wire();
  const o = await r.owner(`o@${tag}.com.au`, `${tag}.com.au`); const p = await r.pro(`p@${tag}.com`);
  const id = (await r.hire(o)).job.id; await r.claim(p.session, id); await r.deliver(p.session, id).then((x) => x.text());
  const audit = (s: string, jid = id) => r.h.req("GET", `/market/jobs/${jid}/dispute/audit`, { token: s });
  return { r, b, o, p, id, wire, audit, tenantOf };
}
test("restart: a new service over the same FakeD1 reads the same durable case and verifies chain AND anchors", async () => {
  const s = await svc("rst");
  assert.equal((await s.r.h.req("POST", `/market/jobs/${s.id}/dispute`, { token: s.o.session, body: { reason: "pro disappeared after claiming" } })).status, 200);
  assert.equal((await s.r.h.req("POST", `/market/jobs/${s.id}/dispute/evidence`, { token: s.p.session, body: { note: "SYNTHETIC: pro log shows the change" } })).status, 200);
  const before = await s.r.h.j(await s.audit(s.o.session)); assert.deepEqual(before.verdict, { ok: true, anchoredThrough: 2, unanchoredTail: 0 });
  assert.equal(s.b.rows(), 1);
  s.r.h.deps.market!.disputes = undefined;   // the process dies: all in-memory trail state is gone
  s.wire();                                   // a fresh Worker isolate: new store objects over the same database
  const after = await s.r.h.j(await s.audit(s.p.session)); assert.deepEqual(after, before);
  // and it keeps working: resolve through the internal route on the restarted instance
  const card = (await s.r.store.openCards())[0];
  assert.equal((await s.r.internal("POST", `/internal/market/cards/${card.id}/resolve`, { outcome: "refund_owner" })).status, 200);
  const done = await s.r.h.j(await s.audit(s.o.session)); assert.equal(done.state, "RESOLVED_REFUNDED"); assert.equal(done.entries, 3);
  assert.deepEqual(done.verdict, { ok: true, anchoredThrough: 3, unanchoredTail: 0 });
  const raw = await new D1DisputeCaseStore(s.b.db!, s.tenantOf).get(s.id); assert.equal(verifyAudit(raw!), null);
});
test("cross-tenant over the routes: a stranger gets the missing-job 404 on audit and evidence, and the durable case is not touched", async () => {
  const s = await svc("xt"); await s.r.h.req("POST", `/market/jobs/${s.id}/dispute`, { token: s.o.session, body: { reason: "pro disappeared after claiming" } });
  const x = await s.r.owner("x@other.com.au", "other.com.au");
  const miss = await s.r.h.req("GET", `/market/jobs/job_nope/dispute/audit`, { token: x.session });
  const a = await s.audit(x.session); assert.equal(a.status, 404); assert.equal(await a.text(), await miss.text());
  assert.equal((await s.r.h.req("POST", `/market/jobs/${s.id}/dispute/evidence`, { token: x.session, body: { note: "SYNTHETIC: injected" } })).status, 404);
  const row = s.b.db!.db.prepare("SELECT tenant_id, audit_len FROM dispute_case WHERE job_id = ?").get(s.id) as any;
  assert.equal(row.audit_len, 1); assert.equal(row.tenant_id, (await s.r.store.getJob(s.id))!.ownerAccountId, "tenant_id is the job owner, not the pro or the stranger");
  assert.equal(Number((s.b.db!.db.prepare("SELECT COUNT(*) n FROM dispute_case").get() as any).n), 1);
});
test("tampered durable row: an edit without recomputing is chain_broken, an edit with recomputed hashes is head_mismatch; neither is ever verified", async () => {
  const s = await svc("tam"); await s.r.h.req("POST", `/market/jobs/${s.id}/dispute`, { token: s.o.session, body: { reason: "pro disappeared after claiming" } });
  await s.r.h.req("POST", `/market/jobs/${s.id}/dispute/evidence`, { token: s.p.session, body: { note: "SYNTHETIC: honest" } });
  const get = () => s.b.db!.db.prepare("SELECT case_json FROM dispute_case WHERE job_id = ?").get(s.id) as any;
  const put = (j: unknown) => s.b.db!.db.prepare("UPDATE dispute_case SET case_json = ? WHERE job_id = ?").run(JSON.stringify(j), s.id);
  const honest = JSON.parse(get().case_json);
  const j = structuredClone(honest); j.audit[1].detail = "SYNTHETIC: forged"; put(j);
  const v1 = (await s.r.h.j(await s.audit(s.o.session))).verdict; assert.equal(v1.ok, false); assert.equal(v1.reason, "chain_broken");
  const f = rewriteAll(honest, 1, "SYNTHETIC: forged and recomputed"); put(f);
  // the head column still holds the honest head, the JSON now ends in a different one: the store refuses to serve it at all
  await assert.rejects(s.audit(s.o.session), CaseRowCorrupt);   // the Worker's catch-all turns this into a bare 500 "internal", never a verified body
  assert.ok((await new D1DisputeCaseStore(s.b.db!, s.tenantOf).get(s.id).catch((e) => e)) instanceof CaseRowCorrupt);
  // an attacker who also fixes the head column is caught by the anchors
  s.b.db!.db.prepare("UPDATE dispute_case SET head = ? WHERE job_id = ?").run(f.audit[f.audit.length - 1].hash, s.id);
  const v2 = (await s.r.h.j(await s.audit(s.o.session))).verdict; assert.deepEqual(v2, { ok: false, reason: "head_mismatch", seq: 2 });
});
