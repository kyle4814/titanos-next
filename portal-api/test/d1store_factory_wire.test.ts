// f216: the DEFAULT createWorker() serves from D1Store over env.DB (no injected seam). FakeD1 = node:sqlite with the real migrations.
// SYNTHETIC data only, nothing live, no secrets read. A restart = a second createWorker() on the SAME FakeD1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FakeD1 } from "./fake_d1.ts";
import { D1Store } from "../src/d1store.ts";
import { sha256Hex } from "../src/util.ts";
import { createWorker } from "../src/index.ts";
import { d1StoreFactory } from "../src/build_deps.ts";
import { verifyRecordName, verifyRecordValue } from "../src/dns.ts";

const ORIGIN = "https://titanos.tech";
const mk = (db: FakeD1) => ({ DB: db as never, TITANOS_SITE_ORIGIN: ORIGIN });
const call = (w: { fetch(r: Request, e: any): Promise<Response> }, e: any, path: string, o: { method?: string; token?: string; body?: unknown } = {}) =>
  w.fetch(new Request("https://api.test" + path, { method: o.method ?? "GET", headers: { ...(o.token ? { authorization: `Bearer ${o.token}` } : {}), ...(o.body ? { "content-type": "application/json" } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined }), e);
async function seedSession(db: FakeD1, id = "acc_synth1", email = "synthetic@example.invalid") {
  const s = new D1Store(db), token = "ss_5eed00000000000000000000000000ab";
  await s.putAccount({ id, email, seat: "owner", createdAt: 1 });
  await s.putSession({ hash: await sha256Hex(token), accountId: id, expiresAt: Date.now() + 3_600_000 });
  return token;
}

test("the shipped factory builds D1Store from the DB binding", () => {
  assert.ok(d1StoreFactory(new FakeD1() as never, {}) instanceof D1Store);
});
test("/health 200 and /me served by D1Store with a seeded session", async () => {
  const db = new FakeD1(), w = createWorker(), tok = await seedSession(db);
  assert.equal((await call(w, mk(db), "/health")).status, 200);
  const r = await call(w, mk(db), "/me", { token: tok });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { id: "acc_synth1", email: "synthetic@example.invalid", seat: "owner" });
  assert.equal((await call(w, mk(db), "/me", { token: "ss_wrong" })).status, 401);
});
test("login token is consumed exactly once through the real route", async () => {
  const db = new FakeD1(), w = createWorker(), s = new D1Store(db), raw = "ll_synthetic_login_token_0001";
  await s.putLoginToken({ hash: await sha256Hex(raw), email: "synthetic@example.invalid", expiresAt: Date.now() + 600_000, used: false });
  const a = await call(w, mk(db), "/auth/verify", { method: "POST", body: { token: raw } });
  assert.equal(a.status, 200); const j: any = await a.json(); assert.match(j.session, /^ss_/);
  const b = await call(w, mk(db), "/auth/verify", { method: "POST", body: { token: raw } });
  assert.equal(b.status, 401); assert.equal(((await b.json()) as any).error, "token_invalid_or_used");
  assert.equal((await call(w, mk(db), "/me", { token: j.session })).status, 200);
});
test("domain verify round trip (TXT via a stubbed DoH fetch)", async () => {
  const db = new FakeD1(), w = createWorker(), tok = await seedSession(db), realFetch = globalThis.fetch;
  try {
    const add = await call(w, mk(db), "/domains", { method: "POST", token: tok, body: { domain: "synthetic-shop.com.au" } });
    assert.equal(add.status, 201); const dom: any = await add.json();
    let txt = "";
    globalThis.fetch = (async (u: any) => { assert.ok(String(u).includes(encodeURIComponent(verifyRecordName("synthetic-shop.com.au")))); return new Response(JSON.stringify({ Answer: txt ? [{ type: 16, data: `"${txt}"` }] : [] }), { status: 200 }); }) as typeof fetch;
    assert.equal((await call(w, mk(db), `/domains/${dom.id}/verify`, { method: "POST", token: tok })).status, 422);
    txt = verifyRecordValue(dom.record.value.replace("titanos-verify=", ""));
    const ok = await call(w, mk(db), `/domains/${dom.id}/verify`, { method: "POST", token: tok });
    assert.equal(ok.status, 200); assert.equal(((await ok.json()) as any).verified, true);
  } finally { globalThis.fetch = realFetch; }
});
test("RESTART: a second createWorker() on the same FakeD1 still sees the session, login history and the verified domain", async () => {
  const db = new FakeD1(), tok = await seedSession(db), realFetch = globalThis.fetch;
  try {
    const w1 = createWorker();
    const dom: any = await (await call(w1, mk(db), "/domains", { method: "POST", token: tok, body: { domain: "restart-synth.com.au" } })).json();
    globalThis.fetch = (async () => new Response(JSON.stringify({ Answer: [{ type: 16, data: `"titanos-verify=${dom.record.value.slice(15)}"` }] }), { status: 200 })) as typeof fetch;
    assert.equal((await call(w1, mk(db), `/domains/${dom.id}/verify`, { method: "POST", token: tok })).status, 200);
  } finally { globalThis.fetch = realFetch; }
  const w2 = createWorker();                                   // fresh isolate, same database
  assert.equal((await call(w2, mk(db), "/me", { token: tok })).status, 200);
  const list: any = await (await call(w2, mk(db), "/domains", { token: tok })).json();
  assert.deepEqual(list.domains.map((d: any) => [d.domain, d.verified]), [["restart-synth.com.au", true]]);
});
test("no DB binding: typed 503 with the named reason; /health still 200; OPTIONS 204", async () => {
  const w = createWorker(), e = { TITANOS_SITE_ORIGIN: ORIGIN };
  assert.equal((await call(w, e, "/health")).status, 200);
  const r = await call(w, e, "/me", { token: "ss_x" }); assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: "deps_unavailable", reason: "missing_binding:DB" });
});
