// f368: shared rig for the owner rejected-path checks (used by f368_owner_rejected_paths.test.ts and post_fuzz.test.ts). SYNTHETIC data only.
import { make } from "./harness.ts";
import { FakeD1 } from "./fake_d1.ts";
import { MemoryZone } from "../src/owner/dnsw.ts";
import { MemoryOwnerStore } from "../src/owner/engine.ts";
import { D1OwnerStore } from "../src/owner/d1ownerstore.ts";
import { healthy } from "./owner_harness.ts";
import { snapshot, type OwnerRejectRig } from "./post_fuzz_lib.ts";

const dumpD1 = (d: FakeD1) => Object.fromEntries((d.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[])
  .map((t) => [t.name, (d.db.prepare(`SELECT * FROM "${t.name}"`).all() as unknown[]).map((r) => JSON.stringify(r)).sort()]));

export async function buildOwnerRejectRig(kind: "memory" | "d1"): Promise<OwnerRejectRig & { rev: () => Promise<number | undefined> }> {
  const domain = "rej368.com.au", d1 = kind === "d1" ? new FakeD1() : undefined;
  const h = make();
  const zone = new MemoryZone(healthy(domain));
  zone.world.txt![domain] = ["v=spf1 include:_spf.google.com ~all"];
  const store = d1 ? new D1OwnerStore(d1, () => h.clock.t) : new MemoryOwnerStore();
  h.deps.owner = { store, doh: () => zone.doh, zones: { zoneFor: (x) => (x === domain ? zone : undefined) } };
  const me = await h.login("rej368@example.com");
  const { d } = await h.verifiedDomain(me.session, domain);
  if (d1) {   // the owner store is D1 (FakeD1, real migrations, FK ON); its FK parents are seeded to match the Worker store's ids
    d1.db.prepare("INSERT INTO accounts (id, email) VALUES (?, ?)").run(me.account.id, "rej368@example.com");
    d1.db.prepare("INSERT INTO domains (id, account_id, domain, verify_token) VALUES (?, ?, ?, 't')").run(d.id, me.account.id, domain);
  }
  return {
    req: h.req, token: me.session, domainId: d.id, domain, zone, clock: h.clock,
    snap: () => snapshot(d1 ? dumpD1(d1) : store, h.store, zone.world),
    rev: async () => (await store.get(d.id))?.rev,
  };
}
