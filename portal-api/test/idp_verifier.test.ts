// C8 f318: the production IdpVerifier (idp_verifier.ts) over the f25 RS256 verifier, with a FAKE fetchJwks only: no network, synthetic keys made in-test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createIdpVerifier, httpJwksFetcher, isSafeJwksUrl, type UrlJwksFetcher } from "../src/enterprise/idp_verifier.ts";
import { buildEnterpriseDeps, parseIdpJwksUris, EntBuildError } from "../src/ent_context.ts";
import type { Jwks } from "../src/enterprise/oidc.ts";
import type { SsoConfig } from "../src/enterprise/types.ts";

const ISS = "https://idp.synth.test", URL1 = "https://idp.synth.test/jwks.json", CID = "client-synth", NOW = 1_800_000_000_000, SEC = NOW / 1000;
const enc = new TextEncoder();
const b64u = (u: Uint8Array | string) => { const b = typeof u === "string" ? enc.encode(u) : u; let s = ""; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
async function genKey(kid: string) {
  const kp = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const pub: any = await crypto.subtle.exportKey("jwk", kp.publicKey);
  return { kid, priv: kp.privateKey, jwk: { kty: "RSA", kid, use: "sig", alg: "RS256", n: pub.n, e: pub.e } };
}
type K = Awaited<ReturnType<typeof genKey>>;
const claims = (o: Record<string, unknown> = {}) => ({ iss: ISS, aud: CID, sub: "u1", email: "a@synth.example", email_verified: true, nonce: "n1", iat: SEC - 10, exp: SEC + 300, ...o });
async function sign(k: K, c: Record<string, unknown>, header: Record<string, unknown> = {}) {
  const h = b64u(JSON.stringify({ alg: "RS256", typ: "JWT", kid: k.kid, ...header })), p = b64u(JSON.stringify(c));
  const s = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", k.priv, enc.encode(`${h}.${p}`)));
  return `${h}.${p}.${b64u(s)}`;
}
const cfg = (o: Partial<SsoConfig> = {}): SsoConfig => ({ tenantId: "ten_1", issuer: ISS, clientId: CID, secret: "x", allowedDomains: ["synth.example"], defaultRole: "member", ...o });
const code = async (p: Promise<unknown>) => { try { await p; return "OK"; } catch (e: any) { return e.code ?? `THROWN:${e.message}`; } };
function rig(initial: Jwks | (() => Jwks | Promise<Jwks>), o: Record<string, unknown> = {}) {
  const calls: string[] = [];
  let doc = initial;
  const fetchJwks: UrlJwksFetcher = async (u) => { calls.push(u); return typeof doc === "function" ? doc() : doc; };
  const v = createIdpVerifier({ fetchJwks, jwksUrls: { [ISS]: URL1 }, ...o });
  return { v, calls, set: (d: typeof initial) => { doc = d; } };
}

test("1 valid RS256 token verifies, claims normalised, one fetch of the PINNED url", async () => {
  const k = await genKey("k1"); const r = rig({ keys: [k.jwk] });
  const out = await r.v.verify(cfg(), await sign(k, claims()), NOW);
  assert.equal(out.email, "a@synth.example"); assert.equal(out.aud, CID); assert.deepEqual(r.calls, [URL1]);
});
test("2 wrong iss in the token is refused", async () => {
  const k = await genKey("k1"); const r = rig({ keys: [k.jwk] });
  assert.equal(await code(r.v.verify(cfg(), await sign(k, claims({ iss: "https://evil.test" })), NOW)), "bad_issuer");
});
test("3 wrong aud, and multi-aud without azp, are refused", async () => {
  const k = await genKey("k1"); const r = rig({ keys: [k.jwk] });
  assert.equal(await code(r.v.verify(cfg(), await sign(k, claims({ aud: "other" })), NOW)), "bad_audience");
  assert.equal(await code(r.v.verify(cfg(), await sign(k, claims({ aud: [CID, "other"] })), NOW)), "bad_audience");
});
test("4 expired token refused; one inside the skew window passes; one past it does not", async () => {
  const k = await genKey("k1"); const r = rig({ keys: [k.jwk] });
  assert.equal(await code(r.v.verify(cfg(), await sign(k, claims({ exp: SEC - 120 })), NOW)), "expired");
  assert.equal(await code(r.v.verify(cfg(), await sign(k, claims({ exp: SEC - 30 })), NOW)), "OK");
});
test("5 skew is bounded: a configured 10 000 s skew is clamped to 300 s", async () => {
  const k = await genKey("k1"); const r = rig({ keys: [k.jwk] }, { skewSec: 10_000 });
  assert.equal(await code(r.v.verify(cfg(), await sign(k, claims({ exp: SEC - 1000 })), NOW)), "expired");
  assert.equal(await code(r.v.verify(cfg(), await sign(k, claims({ iat: SEC + 1000, exp: SEC + 2000 })), NOW)), "bad_iat");
});
test("6 skew zero is honoured (exact expiry)", async () => {
  const k = await genKey("k1"); const r = rig({ keys: [k.jwk] }, { skewSec: 0 });
  assert.equal(await code(r.v.verify(cfg(), await sign(k, claims({ exp: SEC - 1 })), NOW)), "expired");
});
test("7 alg none is refused before any key or fetch", async () => {
  const k = await genKey("k1"); const r = rig({ keys: [k.jwk] });
  const h = b64u(JSON.stringify({ alg: "none", typ: "JWT", kid: "k1" })), p = b64u(JSON.stringify(claims()));
  assert.equal(await code(r.v.verify(cfg(), `${h}.${p}.AAAA`, NOW)), "bad_alg");
  assert.equal(await code(r.v.verify(cfg(), `${h}.${p}.`, NOW)), "bad_token");
  assert.equal(r.calls.length, 0);
});
test("8 HS256 confusion: a token HMAC-signed with the RSA public key material is refused", async () => {
  const k = await genKey("k1"); const r = rig({ keys: [k.jwk] });
  const h = b64u(JSON.stringify({ alg: "HS256", typ: "JWT", kid: "k1" })), p = b64u(JSON.stringify(claims()));
  const mk = await crypto.subtle.importKey("raw", enc.encode(JSON.stringify(k.jwk)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", mk, enc.encode(`${h}.${p}`)));
  assert.equal(await code(r.v.verify(cfg(), `${h}.${p}.${b64u(sig)}`, NOW)), "bad_alg");
  assert.equal(r.calls.length, 0);
});
test("9 other algs (RS384, ES256, PS256, lower-case rs256) are refused", async () => {
  const k = await genKey("k1"); const r = rig({ keys: [k.jwk] });
  for (const alg of ["RS384", "RS512", "ES256", "PS256", "rs256", ""]) assert.equal(await code(r.v.verify(cfg(), await sign(k, claims(), { alg }), NOW)), "bad_alg", alg);
});
test("10 an issuer that is NOT pinned is refused with no fetch (SSRF: tenant text never steers a url)", async () => {
  const k = await genKey("k1"); const r = rig({ keys: [k.jwk] });
  assert.equal(await code(r.v.verify(cfg({ issuer: "https://attacker.test" }), await sign(k, claims({ iss: "https://attacker.test" })), NOW)), "bad_issuer");
  assert.equal(await code(r.v.verify(cfg({ issuer: ISS + "/" }), await sign(k, claims({ iss: ISS + "/" })), NOW)), "bad_issuer");
  assert.equal(r.calls.length, 0);
});
test("11 unknown kid: ONE refetch after the cooldown, none inside it (forged-kid flood does not storm)", async () => {
  const k = await genKey("k1"); const r = rig({ keys: [k.jwk] });
  await r.v.verify(cfg(), await sign(k, claims()), NOW); assert.equal(r.calls.length, 1);
  const forged = await sign(k, claims(), { kid: "nope" });
  for (let i = 0; i < 50; i++) assert.equal(await code(r.v.verify(cfg(), forged, NOW + 1000 + i)), "unknown_kid");
  assert.equal(r.calls.length, 1, "inside the cooldown no refetch at all");
  for (let i = 0; i < 50; i++) await code(r.v.verify(cfg(), forged, NOW + 31_000 + i));
  assert.equal(r.calls.length, 2, "after the cooldown exactly one refetch for 50 forged tokens");
});
test("12 forged kid on a brand-new cache loads once and does not fetch twice", async () => {
  const k = await genKey("k1"); const r = rig({ keys: [k.jwk] });
  assert.equal(await code(r.v.verify(cfg(), await sign(k, claims(), { kid: "nope" }), NOW)), "unknown_kid");
  assert.equal(r.calls.length, 1);
});
test("13 fetch failure fails closed (jwks_unavailable), and a flood inside the backoff does not re-fetch", async () => {
  const k = await genKey("k1"); const r = rig(() => { throw new Error("boom: secret-ish detail"); });
  const t = await sign(k, claims());
  assert.equal(await code(r.v.verify(cfg(), t, NOW)), "jwks_unavailable");
  for (let i = 0; i < 20; i++) assert.equal(await code(r.v.verify(cfg(), t, NOW + 100 + i)), "jwks_unavailable");
  assert.equal(r.calls.length, 1);
  assert.equal(await code(r.v.verify(cfg(), t, NOW + 16_000)), "jwks_unavailable");
  assert.equal(r.calls.length, 2, "one retry once the backoff has passed");
});
test("14 recovery: after the IdP comes back and the backoff passes, tokens verify again", async () => {
  const k = await genKey("k1"); const r = rig(() => { throw new Error("down"); });
  const t = await sign(k, claims({ exp: SEC + 3000 }));
  assert.equal(await code(r.v.verify(cfg(), t, NOW)), "jwks_unavailable");
  r.set({ keys: [k.jwk] });
  assert.equal(await code(r.v.verify(cfg(), t, NOW + 16_000)), "OK");
});
test("15 malformed documents fail closed: not an object, no keys array, empty keys, only junk keys", async () => {
  const k = await genKey("k1");
  for (const bad of [null, "x", { nope: 1 }, { keys: "x" }, { keys: [] }, { keys: [{ kty: "oct", kid: "k1", k: "AAAA" }] }]) {
    const r = rig(bad as any);
    const c = await code(r.v.verify(cfg(), await sign(k, claims()), NOW));
    const nokeys = bad === null || typeof bad !== "object" || !Array.isArray((bad as any).keys);
    assert.equal(c, nokeys ? "jwks_unavailable" : "unknown_kid", `${JSON.stringify(bad)} -> ${c}`);
  }
});
test("16 TTL: after ttlMs the cache is dropped and re-fetched; a key REVOKED at the IdP stops verifying", async () => {
  const k1 = await genKey("k1"), k2 = await genKey("k2"); const r = rig({ keys: [k1.jwk] }, { ttlMs: 120_000 });
  const t = await sign(k1, claims({ exp: SEC + 100_000 }));
  assert.equal(await code(r.v.verify(cfg(), t, NOW)), "OK");
  r.set({ keys: [k2.jwk] });
  assert.equal(await code(r.v.verify(cfg(), t, NOW + 60_000)), "OK", "still inside the ttl: cached");
  assert.equal(r.calls.length, 1);
  assert.equal(await code(r.v.verify(cfg(), t, NOW + 121_000)), "unknown_kid", "ttl passed: k1 is gone");
  assert.equal(r.calls.length, 2);
});
test("17 TTL expiry plus fetch failure does NOT serve the stale keys (fail closed)", async () => {
  const k = await genKey("k1"); const r = rig({ keys: [k.jwk] }, { ttlMs: 60_000 });
  const t = await sign(k, claims({ exp: SEC + 100_000 }));
  assert.equal(await code(r.v.verify(cfg(), t, NOW)), "OK");
  r.set(() => { throw new Error("down"); });
  assert.equal(await code(r.v.verify(cfg(), t, NOW + 61_000)), "jwks_unavailable");
});
test("18 rotation: new kid appears, one refetch picks it up, old kid keeps working while published", async () => {
  const k1 = await genKey("k1"), k2 = await genKey("k2"); const r = rig({ keys: [k1.jwk] });
  assert.equal(await code(r.v.verify(cfg(), await sign(k1, claims()), NOW)), "OK");
  r.set({ keys: [k1.jwk, k2.jwk] });
  assert.equal(await code(r.v.verify(cfg(), await sign(k2, claims()), NOW + 31_000)), "OK");
  assert.equal(await code(r.v.verify(cfg(), await sign(k1, claims()), NOW + 32_000)), "OK");
  assert.equal(r.calls.length, 2);
});
test("19 rotation mid-cooldown: the new kid is refused until the cooldown passes (bounded, not instant)", async () => {
  const k1 = await genKey("k1"), k2 = await genKey("k2"); const r = rig({ keys: [k1.jwk] });
  await r.v.verify(cfg(), await sign(k1, claims()), NOW);
  r.set({ keys: [k1.jwk, k2.jwk] });
  assert.equal(await code(r.v.verify(cfg(), await sign(k2, claims()), NOW + 5_000)), "unknown_kid");
  assert.equal(await code(r.v.verify(cfg(), await sign(k2, claims()), NOW + 31_000)), "OK");
});
test("20 concurrent first logins coalesce into ONE fetch", async () => {
  const k = await genKey("k1"); let n = 0;
  const v = createIdpVerifier({ jwksUrls: { [ISS]: URL1 }, fetchJwks: async () => { n++; await new Promise((r) => setTimeout(r, 20)); return { keys: [k.jwk] }; } });
  const t = await sign(k, claims());
  const out = await Promise.all(Array.from({ length: 10 }, () => code(v.verify(cfg(), t, NOW))));
  assert.deepEqual(out, Array(10).fill("OK")); assert.equal(n, 1);
});
test("21 a document larger than maxKeys is truncated (key count bounded)", async () => {
  const k = await genKey("k1"); const junk = Array.from({ length: 40 }, (_, i) => ({ ...k.jwk, kid: "j" + i }));
  const r = rig({ keys: [...junk, k.jwk] }, { maxKeys: 32 });
  assert.equal(await code(r.v.verify(cfg(), await sign(k, claims()), NOW)), "unknown_kid", "the 41st key is cut");
});
test("22 signature by a different key under the same kid is refused", async () => {
  const k = await genKey("k1"), evil = await genKey("k1"); const r = rig({ keys: [k.jwk] });
  assert.equal(await code(r.v.verify(cfg(), await sign(evil, claims()), NOW)), "bad_signature");
});
test("23 unverified email, missing nonce, bad nowMs and a missing clientId are refused", async () => {
  const k = await genKey("k1"); const r = rig({ keys: [k.jwk] });
  assert.equal(await code(r.v.verify(cfg(), await sign(k, claims({ email_verified: false })), NOW)), "email_not_verified");
  assert.equal(await code(r.v.verify(cfg(), await sign(k, claims({ nonce: undefined })), NOW)), "bad_token");
  assert.equal(await code(r.v.verify(cfg(), await sign(k, claims()), NaN)), "bad_token");
  assert.equal(await code(r.v.verify(cfg({ clientId: "" }), await sign(k, claims()), NOW)), "bad_issuer");
});
test("24 unsafe jwks urls and issuers are dropped at construction (http, creds, fragment): they pin nothing", async () => {
  for (const u of ["http://idp.synth.test/jwks", "https://u:p@idp.synth.test/j", "https://idp.synth.test/j#x", "javascript:1", "", "not a url"]) assert.equal(isSafeJwksUrl(u), false, u);
  assert.equal(isSafeJwksUrl(URL1), true);
  const k = await genKey("k1"); let n = 0;
  const v = createIdpVerifier({ jwksUrls: { [ISS]: "http://idp.synth.test/jwks" }, fetchJwks: async () => { n++; return { keys: [k.jwk] }; } });
  assert.equal(await code(v.verify(cfg(), await sign(k, claims()), NOW)), "bad_issuer"); assert.equal(n, 0);
});
test("25 httpJwksFetcher: https only, no redirect, status 200 only, size cap, JSON shape; passes redirect:error", async () => {
  const seen: any[] = [];
  const mk = (status: number, body: string) => (async (u: any, init: any) => { seen.push([u, init]); return new Response(body, { status }); }) as unknown as typeof fetch;
  const ok = await httpJwksFetcher(mk(200, '{"keys":[]}'))(URL1); assert.deepEqual(ok, { keys: [] });
  assert.equal(seen[0][1].redirect, "error"); assert.equal(seen[0][1].method, "GET");
  await assert.rejects(httpJwksFetcher(mk(500, '{"keys":[]}'))(URL1));
  await assert.rejects(httpJwksFetcher(mk(302, '{"keys":[]}'))(URL1));
  await assert.rejects(httpJwksFetcher(mk(200, "x".repeat(70_000)))(URL1));
  await assert.rejects(httpJwksFetcher(mk(200, '{"nokeys":1}'))(URL1));
  await assert.rejects(httpJwksFetcher(mk(200, "not json"))(URL1));
  await assert.rejects(httpJwksFetcher(mk(200, "{}"))("http://idp.synth.test/j"));
  const before = seen.length; await assert.rejects(httpJwksFetcher(mk(200, "{}"))("http://x.test/j")); assert.equal(seen.length, before, "unsafe url never reaches fetch");
});

// ---- wiring into buildEnterpriseDeps ----
const DB: any = { prepare() { throw new Error("no sql at construction"); } };
const baseEnv = (extra: Record<string, unknown> = {}) => ({ DB, INTERNAL_API_SECRET: "i".repeat(32), ENT_SEAL_KEYS: JSON.stringify({ current: "k1", keys: { k1: "A".repeat(43) } }), ...extra }) as any;
const seams = (extra: Record<string, unknown> = {}) => ({
  storeFactory: () => ({}) as any, approvals: () => ({}) as any, payouts: {} as any, payoutLookup: {} as any,
  accounts: { accountById: async () => undefined }, scan: { source: "synthetic", scan: async () => [] } as any, ...extra,
});
const refusal = (f: () => unknown) => { try { f(); return "BUILT"; } catch (e: any) { return e instanceof EntBuildError ? `${e.reason}:${e.binding}` : `THROWN:${e.message}`; } };

test("26 wire: IDP_JWKS_URIS present builds a real idp that verifies through the injected fetchJwks", async () => {
  const k = await genKey("k1"); const calls: string[] = [];
  const ent = buildEnterpriseDeps(baseEnv({ IDP_JWKS_URIS: JSON.stringify({ [ISS]: URL1 }) }), seams({ fetchJwks: async (u: string) => { calls.push(u); return { keys: [k.jwk] }; } }) as any);
  assert.equal(typeof ent.idp.verify, "function");
  assert.equal(await code(ent.idp.verify(cfg(), await sign(k, claims()), NOW)), "OK"); assert.deepEqual(calls, [URL1]);
});
test("27 wire: binding ABSENT stays a typed refusal even when a fetchJwks seam is passed", () => {
  assert.equal(refusal(() => buildEnterpriseDeps(baseEnv(), seams({ fetchJwks: async () => ({ keys: [] }) }) as any)), "adapter_unavailable:idp");
  assert.equal(refusal(() => buildEnterpriseDeps(baseEnv({ IDP_JWKS_URIS: "" }), seams() as any)), "adapter_unavailable:idp");
});
test("28 wire: a malformed binding is a typed bad_binding naming the binding, never a value", () => {
  for (const bad of ["not json", "[]", "{}", '"x"', JSON.stringify({ [ISS]: "http://insecure.test/j" }), JSON.stringify({ "http://i.test": URL1 }), JSON.stringify({ [ISS]: 5 })]) {
    assert.equal(refusal(() => buildEnterpriseDeps(baseEnv({ IDP_JWKS_URIS: bad }), seams() as any)), "bad_binding:IDP_JWKS_URIS", bad);
  }
  try { parseIdpJwksUris("not json"); } catch (e: any) { assert.ok(!e.message.includes("not json")); }
});
test("29 wire: a supplied seams.idp still wins (test double path), and the binding default fetcher is the https fetch", async () => {
  const fake = { verify: async () => ({}) as any };
  assert.equal(buildEnterpriseDeps(baseEnv(), seams({ idp: fake }) as any).idp, fake);
  const k = await genKey("k1"); const seen: string[] = [];
  const fetchFn = (async (u: any) => { seen.push(String(u)); return new Response(JSON.stringify({ keys: [k.jwk] }), { status: 200 }); }) as unknown as typeof fetch;
  const ent = buildEnterpriseDeps(baseEnv({ IDP_JWKS_URIS: JSON.stringify({ [ISS]: URL1 }) }), seams({ fetchFn }) as any);
  assert.equal(await code(ent.idp.verify(cfg(), await sign(k, claims()), NOW)), "OK"); assert.deepEqual(seen, [URL1]);
});

// ---- survivors of the first mutation pass, now pinned ----
test("30 an unsafe ISSUER key (http) pins nothing even when its url is https", async () => {
  const k = await genKey("k1"); let n = 0;
  const v = createIdpVerifier({ jwksUrls: { "http://idp.synth.test": URL1 }, fetchJwks: async () => { n++; return { keys: [k.jwk] }; } });
  assert.equal(await code(v.verify(cfg({ issuer: "http://idp.synth.test" }), await sign(k, claims({ iss: "http://idp.synth.test" })), NOW)), "bad_issuer"); assert.equal(n, 0);
});
test("31 ttlMs 0 is clamped to the 60 s floor (cache survives 30 s)", async () => {
  const k = await genKey("k1"); const r = rig({ keys: [k.jwk] }, { ttlMs: 0 });
  const t = await sign(k, claims()); await r.v.verify(cfg(), t, NOW); await r.v.verify(cfg(), t, NOW + 30_000); assert.equal(r.calls.length, 1);
});
test("32 a configured refetchCooldownMs is honoured, and 0 is clamped to the 1 s floor", async () => {
  const k = await genKey("k1"); const r = rig({ keys: [k.jwk] }, { refetchCooldownMs: 5_000 });
  await r.v.verify(cfg(), await sign(k, claims()), NOW);
  await code(r.v.verify(cfg(), await sign(k, claims(), { kid: "x" }), NOW + 6_000)); assert.equal(r.calls.length, 2, "5 s cooldown passed at 6 s");
  const z = rig({ keys: [k.jwk] }, { refetchCooldownMs: 0 });
  await z.v.verify(cfg(), await sign(k, claims()), NOW);
  await code(z.v.verify(cfg(), await sign(k, claims(), { kid: "x" }), NOW)); assert.equal(z.calls.length, 1, "0 clamped to 1 s: same instant never refetches");
});
test("33 wire: seams.idp wins even when the binding is present", async () => {
  const fake = { verify: async () => ({}) as any };
  assert.equal(buildEnterpriseDeps(baseEnv({ IDP_JWKS_URIS: JSON.stringify({ [ISS]: URL1 }) }), seams({ idp: fake }) as any).idp, fake);
});
test("34 http: a valid-JSON body over the 64 KB cap is refused", async () => {
  const big = JSON.stringify({ keys: [], pad: "x".repeat(70_000) });
  await assert.rejects(httpJwksFetcher((async () => new Response(big, { status: 200 })) as unknown as typeof fetch)(URL1));
});
