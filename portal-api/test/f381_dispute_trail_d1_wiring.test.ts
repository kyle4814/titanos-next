// f381: the dispute trail is wired to D1 in the real deps (build_deps.ts sideDeps), not memoryTrail. SYNTHETIC data, FakeD1 (real SQLite, EVERY real
// migration incl. 0006 audit_anchor and 0007 dispute_case). Nothing live, no migration applied anywhere real.
// Mutant: `node test/mutate_f381_dispute_wiring.mjs` drops the wiring and requires this file to FAIL.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FakeD1 } from "./fake_d1.ts";
import { buildDeps, sideDeps } from "../src/build_deps.ts";
import { D1DisputeCaseStore } from "../src/market/dispute_case_store.ts";
import { D1AnchorStore } from "../src/market/audit_anchor.ts";
import { dispute, disputeEvidence, disputeAudit, resolveCard } from "../src/market/service.ts";
import { MemoryTenantCaseStore } from "../src/market/dispute_case_store.ts";
import type { Job } from "../src/market/store.ts";

const T0 = 1_800_000_000_000;
const mkEnv = (db: FakeD1) => ({ DB: db as never, TITANOS_SITE_ORIGIN: "https://titanos.tech" });
const fresh = (db: FakeD1, t = T0) => buildDeps(mkEnv(db), { now: () => t });   // one Deps per "request", all over the same database

async function seed(db: FakeD1) {
  const d = fresh(db);
  await d.store.putAccount({ id: "acc_owner", email: "owner@synthetic.example", seat: "owner", createdAt: T0 });
  await d.store.putAccount({ id: "acc_pro", email: "pro@synthetic.example", seat: "pro", createdAt: T0 });
  await d.store.putDomain({ id: "dom_1", accountId: "acc_owner", domain: "synthetic.example", token: "tok", verifiedAt: T0 });
  const job: Job = { id: "job_1", ownerAccountId: "acc_owner", proAccountId: "acc_pro", domainId: "dom_1", domain: "synthetic.example", check: "SPF", severity: "WARN", tier: "small",
    priceCents: 9_900, claimFeeCents: 2_900, status: "delivered", createdAt: T0, updatedAt: T0, baseline: { at: T0, status: "WARN", detail: "SYNTHETIC" }, abandonedBy: [], rescans: 0, warrantyChecks: 0, events: [] } as Job;
  await d.market!.store.putJob(job);
  return { owner: (await d.store.accountById("acc_owner"))!, pro: (await d.store.accountById("acc_pro"))! };
}

test("with a DB bound, sideDeps passes D1 stores (never memory) for the dispute trail", () => {
  const m = sideDeps(mkEnv(new FakeD1())).market;
  assert.ok(m.disputes, "disputes must be wired");
  assert.ok(m.disputes!.cases instanceof D1DisputeCaseStore);
  assert.ok(m.disputes!.anchors instanceof D1AnchorStore);
  assert.ok(!(m.disputes!.cases instanceof MemoryTenantCaseStore));
});

test("open / evidence / resolve persists across separate service instances sharing one FakeD1; trail never falls to memoryTrail", async () => {
  const db = new FakeD1(); const { owner, pro } = await seed(db);
  const a = fresh(db, T0 + 1_000);
  await dispute(a, owner, "job_1", "SYNTHETIC: pro vanished after delivery");
  assert.ok(a.market!.disputes!.cases instanceof D1DisputeCaseStore, "service.ts must not have defaulted to memoryTrail");

  const b = fresh(db, T0 + 2_000);   // a different request/instance: fresh CAS state, same database
  assert.deepEqual((await disputeAudit(b, owner, "job_1")).verdict, { ok: true, anchoredThrough: 1, unanchoredTail: 0 });
  await disputeEvidence(b, pro, "job_1", { note: "SYNTHETIC: pro change log", eventId: "ev_pro_1" });

  const c = fresh(db, T0 + 3_000);
  await disputeEvidence(c, owner, "job_1", { note: "SYNTHETIC: owner screenshot", eventId: "ev_owner_1" });
  const card = (await c.market!.store.openCards())[0];
  await resolveCard(c, card.id, "resume");

  const e = fresh(db, T0 + 4_000);
  const rep = await disputeAudit(e, pro, "job_1");
  assert.equal(rep.entries, 4); assert.deepEqual(rep.verdict, { ok: true, anchoredThrough: 4, unanchoredTail: 0 });
  assert.ok(e.market!.disputes!.cases instanceof D1DisputeCaseStore);
  assert.equal(db.log.filter((l) => /FROM dispute_case|INTO dispute_case|UPDATE dispute_case/.test(l.sql)).length > 0, true, "rows really went through dispute_case");
  const rows = db.db.prepare("SELECT tenant_id, job_id, audit_len FROM dispute_case").all() as any[];
  assert.deepEqual(rows.map((r) => [r.tenant_id, r.job_id, r.audit_len]), [["acc_owner", "job_1", 4]]);
  assert.equal((db.db.prepare("SELECT COUNT(*) n FROM audit_anchor WHERE job_id = 'job_1'").get() as any).n, 4);
});

test("a party who is not the owner or pro still gets 404 on the D1 trail; an unknown job has no case", async () => {
  const db = new FakeD1(); const { owner } = await seed(db);
  const d = fresh(db);
  await assert.rejects(disputeAudit(d, { ...owner, id: "acc_other" }, "job_1"), (e: any) => e.status === 404);
  assert.equal(await d.market!.disputes!.cases.get("job_missing"), undefined);
});

test("tenant scope is the job's OWNER: two owners' cases land under their own tenant_id (a constant tenant would bleed)", async () => {
  const db = new FakeD1(); const { owner } = await seed(db);
  const s = fresh(db);
  await s.store.putAccount({ id: "acc_owner2", email: "owner2@synthetic.example", seat: "owner", createdAt: T0 });
  await s.store.putDomain({ id: "dom_2", accountId: "acc_owner2", domain: "synthetic2.example", token: "tok2", verifiedAt: T0 });
  await s.market!.store.putJob({ ...(await s.market!.store.getJob("job_1"))!, id: "job_2", ownerAccountId: "acc_owner2", domainId: "dom_2", domain: "synthetic2.example" });
  const owner2 = (await s.store.accountById("acc_owner2"))!;
  await dispute(fresh(db), owner, "job_1", "SYNTHETIC: first owner dispute");
  await dispute(fresh(db), owner2, "job_2", "SYNTHETIC: second owner dispute");
  const rows = db.db.prepare("SELECT tenant_id, job_id FROM dispute_case ORDER BY job_id").all() as any[];
  assert.deepEqual(rows.map((r) => [r.tenant_id, r.job_id]), [["acc_owner", "job_1"], ["acc_owner2", "job_2"]]);
});
