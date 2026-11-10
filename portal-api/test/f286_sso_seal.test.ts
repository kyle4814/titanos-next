// C8 f286: SSO client secrets are sealed before any store write (AES-GCM, key id, AAD = tenant), and the f25 RS256
// verifier sits behind IdpVerifier in ssoCallback. Synthetic data: the IdP keypair is generated here, in tests only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEnt, raw } from "./ent_harness.ts";
import { createOidcVerifier } from "../src/enterprise/oidc.ts";
import { sealSecret, openSecret, newSealKey, parseSealKeys, isSealed, SealError, type SealKeyring } from "../src/enterprise/seal.ts";
import { MemoryEntStore } from "../src/enterprise/store.ts";

const PLAIN = "synthetic_sso_client_secret_PLAINTEXT_f286";
const ISS = "https://idp.mock.test";
const enc = new TextEncoder();
const b64u = (u: Uint8Array | string) => { const b = typeof u === "string" ? enc.encode(u) : u; let s = ""; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const code = async (p: Promise<unknown>) => { try { await p; return "OK"; } catch (e: any) { return e.code ?? `THROWN:${e.message}`; } };

async function genKey(kid: string) {
  const kp = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const pub: any = await crypto.subtle.exportKey("jwk", kp.publicKey);
  return { kid, priv: kp.privateKey, jwk: { kty: "RSA", kid, use: "sig", alg: "RS256", n: pub.n, e: pub.e } };
}
async function rsSign(k: Awaited<ReturnType<typeof genKey>>, c: Record<string, unknown>, header: Record<string, unknown> = {}) {
  const h = b64u(JSON.stringify({ alg: "RS256", typ: "JWT", kid: k.kid, ...header })), p = b64u(JSON.stringify(c));
  return `${h}.${p}.${b64u(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", k.priv, enc.encode(`${h}.${p}`))))}`;
}

async function world() {
  const h = makeEnt();
  const idpKey = await genKey("idp1");
  h.deps.ent!.idp = createOidcVerifier({ jwks: { keys: [idpKey.jwk] } });                // f25 verifier behind the interface
  const o = await h.provision("enterprise", "ciso@bigco.com.au", "BigCo", "bigco");
  const tid = o.tenant.id;
  await h.addVerifiedAsset(o.session, tid, "bigco.com.au");
  const view = await h.configureSso(o.session, tid, "bigco.com.au", PLAIN);
  const clientId = view.clientId as string;
  const now = () => Math.floor(h.clock.t / 1000);
  const claims = (nonce: string, over: Record<string, unknown> = {}) => ({ iss: ISS, aud: clientId, sub: "idp|a", email: "a@bigco.com.au", email_verified: true, nonce, iat: now() - 5, exp: now() + 300, ...over });
  async function login(over: Record<string, unknown> = {}, o2: { header?: Record<string, unknown>; nonceOverride?: string; key?: typeof idpKey; tamper?: boolean; stateNonce?: string } = {}) {
    const st = await h.j(await h.req("POST", "/sso/bigco/start"));
    let tok = await rsSign(o2.key ?? idpKey, claims(o2.nonceOverride ?? st.nonce, over), o2.header);
    if (o2.tamper) { const p = tok.split("."); p[2] = p[2].slice(0, -4) + (p[2].endsWith("AAAA") ? "BBBB" : "AAAA"); tok = p.join("."); }
    const res = await h.req("POST", "/sso/callback", { body: { state: st.state, nonce: o2.stateNonce ?? st.nonce, id_token: tok } });
    return { res, body: await h.j(res.clone()), st };
  }
  return { h, o, tid, clientId, idpKey, login, store: h.store as MemoryEntStore };
}
const dump = (s: MemoryEntStore) => JSON.stringify(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v instanceof Map ? [...v] : v instanceof Set ? [...v] : v])));

test("putSso stores only a sealed envelope; plaintext never appears in a serialised dump of the store, the response or the audit", async () => {
  const { h, o, tid, store } = await world();
  const row = await store.ssoOf(tid);
  assert.ok(row && isSealed(row.secret), "stored secret is a tsl1 envelope");
  assert.notEqual(row!.secret, PLAIN);
  assert.equal(dump(store).includes(PLAIN), false, "no plaintext anywhere in the store dump");
  assert.equal(JSON.stringify(await h.get(o.session, `/enterprise/${tid}/sso`)).includes(PLAIN), false);
  assert.equal(JSON.stringify(await h.get(o.session, `/enterprise/${tid}/audit`)).includes(PLAIN), false);
  assert.ok(dump(store).includes("tsl1.k1."), "the envelope names its key id");
});

test("sealing is randomised: the same secret sealed twice gives different envelopes (fresh nonce)", async () => {
  const ring: SealKeyring = { current: "k1", keys: { k1: newSealKey() } };
  const a = await sealSecret(ring, PLAIN, "sso:t1"), b = await sealSecret(ring, PLAIN, "sso:t1");
  assert.notEqual(a, b);
  assert.notEqual(a.split(".")[2], b.split(".")[2], "iv differs");
  assert.equal(await openSecret(ring, a, "sso:t1"), PLAIN);
  assert.equal(await openSecret(ring, b, "sso:t1"), PLAIN);
});

test("round trip: the sealed secret opens to the original under the right tenant context only", async () => {
  const { h, tid, store } = await world();
  const ring = h.deps.ent!.sealKeys!;
  const row = (await store.ssoOf(tid))!;
  assert.equal(await openSecret(ring, row.secret, `sso:${tid}`), PLAIN);
  assert.equal(await code(openSecret(ring, row.secret, "sso:other_tenant")), "decrypt_failed", "AAD binds the tenant");
});

test("tamper is detected: any flipped ciphertext/iv/header byte fails to open, and a tampered stored row fails the callback closed", async () => {
  const ring: SealKeyring = { current: "k1", keys: { k1: newSealKey() } };
  const env = await sealSecret(ring, PLAIN, "c");
  const p = env.split(".");
  const flip = (s: string) => s.slice(0, 2) + (s[2] === "A" ? "B" : "A") + s.slice(3);
  assert.equal(await code(openSecret(ring, [p[0], p[1], p[2], flip(p[3])].join("."), "c")), "decrypt_failed");
  assert.equal(await code(openSecret(ring, [p[0], p[1], flip(p[2]), p[3]].join("."), "c")), "decrypt_failed");
  assert.equal(await code(openSecret(ring, ["tsl2", p[1], p[2], p[3]].join("."), "c")), "bad_envelope");
  assert.equal(await code(openSecret(ring, p.slice(0, 3).join("."), "c")), "bad_envelope");
  const w = await world();
  const row = (await w.store.ssoOf(w.tid))!;
  const q = row.secret.split("."); q[3] = flip(q[3]);
  raw.setSsoSecret(w.store, w.tid, row, q.join("."));
  const r = await w.login();
  assert.equal(r.res.status, 401); assert.equal(r.body.session, undefined);
});

test("wrong or unknown key id is rejected, never falls back to another key", async () => {
  const ring: SealKeyring = { current: "k1", keys: { k1: newSealKey(), k2: newSealKey() } };
  const env = await sealSecret(ring, PLAIN, "c");
  const swapped = env.replace("tsl1.k1.", "tsl1.k2.");                       // right shape, other real key
  assert.equal(await code(openSecret(ring, swapped, "c")), "decrypt_failed");
  assert.equal(await code(openSecret(ring, env.replace("tsl1.k1.", "tsl1.zz."), "c")), "unknown_key");
  assert.equal(await code(openSecret(ring, env.replace("tsl1.k1.", "tsl1.__proto__."), "c")), "unknown_key");
  assert.equal(await code(openSecret({ current: "k1", keys: { k2: ring.keys.k2 } }, env, "c")), "unknown_key", "retired key id");
  const w = await world();
  const row = (await w.store.ssoOf(w.tid))!;
  raw.setSsoSecret(w.store, w.tid, row, row.secret.replace("tsl1.k1.", "tsl1.zz."));
  assert.equal((await w.login()).res.status, 401);
});

test("rotation: a new current key seals new secrets while old envelopes still open", async () => {
  const w = await world();
  const ring = w.h.deps.ent!.sealKeys!;
  ring.keys.k2 = newSealKey(); ring.current = "k2";
  assert.equal((await w.login()).res.status, 200, "row sealed under k1 still opens");
  await w.h.configureSso(w.o.session, w.tid, "bigco.com.au", PLAIN + "_rotated");
  assert.ok((await w.store.ssoOf(w.tid))!.secret.startsWith("tsl1.k2."));
});

test("fail closed: no keyring means putSso answers 503 and nothing is stored; the memory adapter itself refuses plaintext", async () => {
  const h = makeEnt();
  const o = await h.provision("enterprise", "ciso@bigco.com.au", "BigCo", "bigco");
  await h.addVerifiedAsset(o.session, o.tenant.id, "bigco.com.au");
  delete h.deps.ent!.sealKeys;
  const r = await h.configureSso(o.session, o.tenant.id, "bigco.com.au", PLAIN);
  assert.equal(r.error, "sso_seal_unavailable");
  assert.equal(await h.store.ssoOf(o.tenant.id), undefined);
  assert.equal(dump(h.store).includes(PLAIN), false);
  await assert.rejects(new MemoryEntStore().putSso({ tenantId: "t", issuer: ISS, clientId: "c", secret: PLAIN, allowedDomains: [], defaultRole: "viewer" }), /sso_secret_not_sealed/);
});

test("a legacy plaintext row (or a missing keyring at login) cannot sign anyone in", async () => {
  const w = await world();
  const row = (await w.store.ssoOf(w.tid))!;
  raw.setSsoSecret(w.store, w.tid, row, PLAIN);                         // bypass the adapter guard to model an old row
  assert.equal((await w.login()).res.status, 401);
  raw.setSsoSecret(w.store, w.tid, row, row.secret);
  delete w.h.deps.ent!.sealKeys;
  assert.equal((await w.login()).res.status, 401);
});

test("parseSealKeys: the SSO_SEAL_KEYS env contract is strict", () => {
  const k = newSealKey();
  const ok = parseSealKeys(JSON.stringify({ current: "k1", keys: { k1: k } }));
  assert.equal(ok.current, "k1"); assert.deepEqual({ ...ok.keys }, { k1: k });
  for (const bad of [undefined, "", "not json", "{}", JSON.stringify({ current: "k9", keys: { k1: k } }), JSON.stringify({ current: "k1", keys: { k1: "short" } }), JSON.stringify({ current: "k1", keys: [k] }), JSON.stringify({ current: "bad id!", keys: { "bad id!": k } })])
    assert.throws(() => parseSealKeys(bad as any), (e: any) => e instanceof SealError && e.code === "seal_keys_unavailable");
});

test("callback with the RS256 verifier: a good token signs in (secret never needed to verify), sessions stay 8 hours", async () => {
  const w = await world();
  const r = await w.login();
  assert.equal(r.res.status, 200); assert.ok(r.body.session);
  assert.equal(r.body.account.email, "a@bigco.com.au");
});

test("callback rejects bad nonce, audience, issuer, alg none/HS256, wrong key, tampered signature, expiry beyond skew; allows skew", async () => {
  const w = await world();
  const stranger = await genKey("idp1");                                      // same kid, attacker key
  const cases: [string, Parameters<typeof w.login>][] = [
    ["nonce in token differs from state", [{}, { nonceOverride: "nn_other" }]],
    ["nonce sent by caller differs from state", [{}, { stateNonce: "nn_forged" }]],
    ["wrong audience", [{ aud: "someone-else" }]],
    ["array audience w/o azp", [{ aud: [w.clientId, "x"] }]],
    ["wrong issuer", [{ iss: "https://idp.evil.test" }]],
    ["alg none", [{}, { header: { alg: "none" } }]],
    ["alg HS256", [{}, { header: { alg: "HS256" } }]],
    ["attacker key, known kid", [{}, { key: stranger }]],
    ["tampered signature", [{}, { tamper: true }]],
    ["expired beyond skew", [{ exp: Math.floor(w.h.clock.t / 1000) - 61 }]],
    ["future iat beyond skew", [{ iat: Math.floor(w.h.clock.t / 1000) + 3600 }]],
    ["email unverified", [{ email_verified: false }]],
    ["email at another domain", [{ email: "a@evil.com" }]],
  ];
  for (const [name, args] of cases) {
    const r = await w.login(...args);
    assert.ok(r.res.status === 401 || r.res.status === 403, `${name}: got ${r.res.status}`);
    assert.equal(r.body.session, undefined, name);
  }
  assert.equal((await w.login({ exp: Math.floor(w.h.clock.t / 1000) - 30 })).res.status, 200, "inside the 60 s skew");
});

test("callback state is single use even with a valid RS256 token", async () => {
  const w = await world();
  const st = await w.h.j(await w.h.req("POST", "/sso/bigco/start"));
  const tok = await rsSign(w.idpKey, { iss: ISS, aud: w.clientId, sub: "s", email: "a@bigco.com.au", email_verified: true, nonce: st.nonce, iat: Math.floor(w.h.clock.t / 1000), exp: Math.floor(w.h.clock.t / 1000) + 300 });
  const body = { state: st.state, nonce: st.nonce, id_token: tok };
  assert.equal((await w.h.req("POST", "/sso/callback", { body })).status, 200);
  assert.equal((await w.h.req("POST", "/sso/callback", { body })).status, 401);
});
