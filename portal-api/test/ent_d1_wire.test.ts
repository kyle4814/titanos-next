// C8 f315: the f314 seams (storeFactory, approvals) accept the D1 adapters, and the constructed context really reads and writes D1.
// SYNTHETIC data. Nothing is applied to a real D1: FakeD1 = node:sqlite plus the real migration files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEnterpriseDeps } from "../src/ent_context.ts";
import { D1EntStore, D1ApprovalStore, d1EntStoreFactory, d1ApprovalFactory } from "../src/enterprise/d1store.ts";
import { MemoryStore } from "../src/store.ts";
import { FakeD1 } from "./fake_d1.ts";
import { ENT_ENV, MockPayouts, entSeams } from "./ent_harness.ts";

const NOW = 1_800_000_000_000;
const mk = () => {
  const db = new FakeD1();
  const seams = { ...entSeams({ store: undefined as never, payouts: new MockPayouts(), deps: { store: new MemoryStore() } }), storeFactory: d1EntStoreFactory, approvals: d1ApprovalFactory };
  return { db, ent: buildEnterpriseDeps({ ...(ENT_ENV() as object), DB: db } as never, seams as never) };
};

test("d1 wire 1: the seams build a context whose store and approvals are the D1 adapters, and construction writes nothing", async () => {
  const { db, ent } = mk();
  assert.ok(ent.store instanceof D1EntStore); assert.ok(ent.approvals instanceof D1ApprovalStore);
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(db.log.length, 0, "no query at construction");
});

test("d1 wire 2: tenant A's rows are invisible to tenant B through the constructed store; the SSO secret lands sealed", async () => {
  const { db, ent } = mk();
  for (const id of ["A", "B"]) await ent.store.putTenant({ id, slug: id.toLowerCase(), name: id, kind: "enterprise", createdAt: NOW, ssoEnforced: false, partnerAccess: false });
  await ent.store.putAsset({ id: "as1", tenantId: "A", domain: "a.example.test", label: "A", group: "g", token: "t", verifiedAt: NOW });
  assert.equal(await ent.store.assetOf("B", "as1"), undefined);
  assert.deepEqual(await ent.store.assetsOf("B"), []);
  await assert.rejects(() => ent.store.putSso({ tenantId: "A", issuer: "https://i.example.test", clientId: "c", secret: "PLAINTEXT_SYNTHETIC", allowedDomains: [], defaultRole: "viewer" }), /sso_secret_not_sealed/);
  assert.equal((db.db.prepare("SELECT COUNT(*) AS n FROM sso_configs").get() as any).n, 0);
});

test("d1 wire 3: the other seams stay typed refusals (payouts, idp, accounts are GATE2 and unchanged by this lane)", () => {
  for (const [name, over, binding] of [["payouts", { payouts: undefined }, "payouts"], ["idp", { idp: undefined, fetchJwks: undefined }, "idp"]] as const) {
    const db = new FakeD1();
    const seams = { ...entSeams({ store: undefined as never, payouts: new MockPayouts(), deps: { store: new MemoryStore() } }), storeFactory: d1EntStoreFactory, approvals: d1ApprovalFactory, ...over };
    assert.throws(() => buildEnterpriseDeps({ ...(ENT_ENV() as object), DB: db } as never, seams as never), (e: any) => e.reason === "adapter_unavailable" && e.binding === binding, name);
  }
});
