import { test } from "node:test";
import assert from "node:assert/strict";
import { createOidcVerifier, type Jwks } from "../src/enterprise/oidc.ts";
import { sealSecret, openSecret, newSealKey, isSealed, type SealKeyring } from "../src/enterprise/seal.ts";

const ISS = "https://idp.example.test", CID = "client-abc", NOW = 1_800_000_000_000, SEC = NOW / 1000;
const enc = new TextEncoder();
const b64u = (u: Uint8Array | string) => { const b = typeof u === "string" ? enc.encode(u) : u; let s = ""; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function genKey(kid: string, bits = 2048) {
  const kp = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: bits, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const pub: any = await crypto.subtle.exportKey("jwk", kp.publicKey);
  return { kid, priv: kp.privateKey, jwk: { kty: "RSA", kid, use: "sig", alg: "RS256", n: pub.n, e: pub.e } };
}
type K = Awaited<ReturnType<typeof genKey>>;
const claims = (o: Record<string, unknown> = {}) => ({ iss: ISS, aud: CID, sub: "u1", email: "a@bigco.com.au", email_verified: true, nonce: "n1", iat: SEC - 10, exp: SEC + 300, ...o });
async function sign(k: K, c: Record<string, unknown>, header: Record<string, unknown> = {}) {
  const h = b64u(JSON.stringify({ alg: "RS256", typ: "JWT", kid: k.kid, ...header })), p = b64u(JSON.stringify(c));
  const s = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", k.priv, enc.encode(`${h}.${p}`)));
  return `${h}.${p}.${b64u(s)}`;
}
const exp = { issuer: ISS, clientId: CID, nonce: "n1" };
const code = async (p: Promise<unknown>) => { try { await p; return "OK"; } catch (e: any) { return e.code ?? `THROWN:${e.message}`; } };

test("valid RS256 token verifies and returns normalised claims", async () => {
  const k = await genKey("k1");
  const v = createOidcVerifier({ jwks: { keys: [k.jwk] } });
  const out = await v.verifyIdToken(await sign(k, claims()), exp, NOW);
  assert.equal(out.email, "a@bigco.com.au"); assert.equal(out.aud, CID); assert.equal(out.nonce, "n1");
});
test("IdpVerifier-shaped verify(cfg,...) works and leaves the nonce to the caller", async () => {
  const k = await genKey("k1");
  const v = createOidcVerifier({ jwks: { keys: [k.jwk] } });
  assert.equal((await v.verify({ issuer: ISS, clientId: CID }, await sign(k, claims({ nonce: "anything" })), NOW)).nonce, "anything");
});
test("wrong audience, wrong issuer, multi-aud without azp", async () => {
  const k = await genKey("k1"); const v = createOidcVerifier({ jwks: { keys: [k.jwk] } });
  assert.equal(await code(v.verifyIdToken(await sign(k, claims({ aud: "other" })), exp, NOW)), "bad_audience");
  assert.equal(await code(v.verifyIdToken(await sign(k, claims({ iss: "https://evil.test" })), exp, NOW)), "bad_issuer");
  assert.equal(await code(v.verifyIdToken(await sign(k, claims({ aud: [CID, "x"] })), exp, NOW)), "bad_audience");
  assert.equal((await v.verifyIdToken(await sign(k, claims({ aud: [CID, "x"], azp: CID })), exp, NOW)).aud, CID);
  assert.equal(await code(v.verifyIdToken(await sign(k, claims({ azp: "other" })), exp, NOW)), "bad_audience");
});
test("expiry, nbf and iat with a small skew", async () => {
  const k = await genKey("k1"); const v = createOidcVerifier({ jwks: { keys: [k.jwk] }, skewSec: 60 });
  assert.equal(await code(v.verifyIdToken(await sign(k, claims({ exp: SEC - 61 })), exp, NOW)), "expired");
  assert.equal(await code(v.verifyIdToken(await sign(k, claims({ exp: SEC - 30 })), exp, NOW)), "OK");       // inside skew
  assert.equal(await code(v.verifyIdToken(await sign(k, claims({ nbf: SEC + 120 })), exp, NOW)), "not_yet_valid");
  assert.equal(await code(v.verifyIdToken(await sign(k, claims({ nbf: SEC + 30 })), exp, NOW)), "OK");
  assert.equal(await code(v.verifyIdToken(await sign(k, claims({ iat: SEC + 600 })), exp, NOW)), "bad_iat");
  assert.equal(await code(v.verifyIdToken(await sign(k, claims({ exp: "9999999999" })), exp, NOW)), "expired");
});
test("nonce mismatch and unverified email are refused", async () => {
  const k = await genKey("k1"); const v = createOidcVerifier({ jwks: { keys: [k.jwk] } });
  assert.equal(await code(v.verifyIdToken(await sign(k, claims({ nonce: "zzz" })), exp, NOW)), "bad_nonce");
  assert.equal(await code(v.verifyIdToken(await sign(k, claims({ email_verified: false })), exp, NOW)), "email_not_verified");
});
test("tampered payload and tampered signature fail", async () => {
  const k = await genKey("k1"); const v = createOidcVerifier({ jwks: { keys: [k.jwk] } });
  const [h, , s] = (await sign(k, claims())).split(".");
  const evil = `${h}.${b64u(JSON.stringify(claims({ email: "boss@bigco.com.au" })))}.${s}`;
  assert.equal(await code(v.verifyIdToken(evil, exp, NOW)), "bad_signature");
  const good = (await sign(k, claims())).split(".");
  const sig = unb(good[2]); sig[5] ^= 1;
  assert.equal(await code(v.verifyIdToken(`${good[0]}.${good[1]}.${b64u(sig)}`, exp, NOW)), "bad_signature");
});
test("alg confusion: none, HS256 keyed with the public modulus, ES256, missing alg, crit", async () => {
  const k = await genKey("k1"); const v = createOidcVerifier({ jwks: { keys: [k.jwk] } });
  const p = b64u(JSON.stringify(claims()));
  assert.equal(await code(v.verifyIdToken(`${b64u(JSON.stringify({ alg: "none", kid: "k1" }))}.${p}.`, exp, NOW)), "bad_token");
  assert.equal(await code(v.verifyIdToken(`${b64u(JSON.stringify({ alg: "none", kid: "k1" }))}.${p}.AAAA`, exp, NOW)), "bad_alg");
  // classic attack: HS256 MAC using the public key material as the HMAC secret
  const h = b64u(JSON.stringify({ alg: "HS256", typ: "JWT", kid: "k1" }));
  const hk = await crypto.subtle.importKey("raw", enc.encode(k.jwk.n), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = b64u(new Uint8Array(await crypto.subtle.sign("HMAC", hk, enc.encode(`${h}.${p}`))));
  assert.equal(await code(v.verifyIdToken(`${h}.${p}.${mac}`, exp, NOW)), "bad_alg");
  assert.equal(await code(v.verifyIdToken(`${b64u(JSON.stringify({ alg: "ES256", kid: "k1" }))}.${p}.AAAA`, exp, NOW)), "bad_alg");
  assert.equal(await code(v.verifyIdToken(`${b64u(JSON.stringify({ kid: "k1" }))}.${p}.AAAA`, exp, NOW)), "bad_alg");
  assert.equal(await code(v.verifyIdToken(await sign(k, claims(), { crit: ["x"] }), exp, NOW)), "bad_token");
  assert.equal(await code(v.verifyIdToken("a.b", exp, NOW)), "bad_token");
  assert.equal(await code(v.verifyIdToken("x".repeat(9000), exp, NOW)), "bad_token");
});
test("unknown kid, missing kid, and a key signed by an attacker's key under a known kid", async () => {
  const k = await genKey("k1"), atk = await genKey("k1");
  const v = createOidcVerifier({ jwks: { keys: [k.jwk] } });
  assert.equal(await code(v.verifyIdToken(await sign(await genKey("nope"), claims()), exp, NOW)), "unknown_kid");
  assert.equal(await code(v.verifyIdToken(await sign(k, claims(), { kid: undefined }), exp, NOW)), "bad_token");
  assert.equal(await code(v.verifyIdToken(await sign(atk, claims()), exp, NOW)), "bad_signature");
});
test("rotation: unknown kid triggers exactly one refetch, then the new key works; cooldown stops a flood", async () => {
  const k1 = await genKey("k1"), k2 = await genKey("k2");
  let live: Jwks = { keys: [k1.jwk] }, calls = 0;
  const v = createOidcVerifier({ fetchJwks: async (iss) => { assert.equal(iss, ISS); calls++; return live; }, refetchCooldownMs: 30_000 });
  assert.equal(await code(v.verifyIdToken(await sign(k1, claims()), exp, NOW)), "OK");
  assert.equal(calls, 1);
  assert.equal(await code(v.verifyIdToken(await sign(k1, claims()), exp, NOW + 1000)), "OK");
  assert.equal(calls, 1, "known kid never refetches");
  live = { keys: [k1.jwk, k2.jwk] };
  assert.equal(await code(v.verifyIdToken(await sign(k2, claims()), exp, NOW + 5000)), "unknown_kid"); // inside cooldown
  assert.equal(calls, 1);
  assert.equal(await code(v.verifyIdToken(await sign(k2, claims()), exp, NOW + 40_000)), "OK");         // cooldown over: one refetch
  assert.equal(calls, 2);
  const junk = await sign(await genKey("junk"), claims());
  assert.equal(await code(v.verifyIdToken(junk, exp, NOW + 80_000)), "unknown_kid");
  assert.equal(calls, 3, "one refetch per junk token");
  assert.equal(await code(v.verifyIdToken(junk, exp, NOW + 80_001)), "unknown_kid");
  assert.equal(calls, 3, "second junk inside cooldown does not refetch");
});
test("rotation: a retired key stops verifying after the refetch", async () => {
  const k1 = await genKey("k1"), k2 = await genKey("k2"); let live: Jwks = { keys: [k1.jwk] };
  const v = createOidcVerifier({ fetchJwks: async () => live });
  await v.verifyIdToken(await sign(k1, claims()), exp, NOW);
  live = { keys: [k2.jwk] };
  assert.equal(await code(v.verifyIdToken(await sign(k2, claims()), exp, NOW + 60_000)), "OK");
  assert.equal(await code(v.verifyIdToken(await sign(k1, claims()), exp, NOW + 61_000)), "unknown_kid");
});
test("fetcher failure and absent keys are jwks_unavailable; weak and wrong-purpose keys are ignored", async () => {
  const k = await genKey("k1");
  assert.equal(await code(createOidcVerifier({ fetchJwks: async () => { throw new Error("net"); } }).verifyIdToken(await sign(k, claims()), exp, NOW)), "jwks_unavailable");
  assert.equal(await code(createOidcVerifier({}).verifyIdToken(await sign(k, claims()), exp, NOW)), "jwks_unavailable");
  const weak = await genKey("k1", 1024);
  assert.equal(await code(createOidcVerifier({ jwks: { keys: [weak.jwk] } }).verifyIdToken(await sign(weak, claims()), exp, NOW)), "unknown_kid");
  const enc2 = { ...k.jwk, use: "enc" };
  assert.equal(await code(createOidcVerifier({ jwks: { keys: [enc2] } }).verifyIdToken(await sign(k, claims()), exp, NOW)), "unknown_kid");
});
test("keys are cached per issuer: another issuer's key never verifies this issuer's token", async () => {
  const k = await genKey("k1"), other = await genKey("k1");
  const v = createOidcVerifier({ fetchJwks: async (iss) => ({ keys: [iss === ISS ? k.jwk : other.jwk] }) });
  assert.equal(await code(v.verifyIdToken(await sign(k, claims()), exp, NOW)), "OK");
  assert.equal(await code(v.verifyIdToken(await sign(k, claims({ iss: "https://b.test" })), { ...exp, issuer: "https://b.test" }, NOW)), "bad_signature");
});

// ---------- seal ----------
const ring = (): SealKeyring => ({ current: "s1", keys: { s1: newSealKey() } });
test("seal: round trip; envelope is versioned and carries no plaintext; IV is fresh", async () => {
  const r = ring(), secret = "idp-client-secret-VALUE-123";
  const a = await sealSecret(r, secret, "tenant:t1"), b = await sealSecret(r, secret, "tenant:t1");
  assert.ok(isSealed(a) && a.startsWith("tsl1.s1."));
  assert.ok(!a.includes(secret) && !a.includes(btoa(secret)));
  assert.notEqual(a, b);
  assert.equal(await openSecret(r, a, "tenant:t1"), secret);
  assert.equal(await openSecret(r, b, "tenant:t1"), secret);
});
test("seal: tamper, wrong context, wrong key, truncation and junk all fail with opaque codes", async () => {
  const r = ring(), env = await sealSecret(r, "s3cret", "tenant:t1");
  const p = env.split(".");
  const flip = (s: string) => { const u = unb(s); u[0] ^= 1; return b64u(u); };
  assert.equal(await code(openSecret(r, `${p[0]}.${p[1]}.${p[2]}.${flip(p[3])}`, "tenant:t1")), "decrypt_failed");
  assert.equal(await code(openSecret(r, `${p[0]}.${p[1]}.${flip(p[2])}.${p[3]}`, "tenant:t1")), "decrypt_failed");
  assert.equal(await code(openSecret(r, env, "tenant:t2")), "decrypt_failed");
  assert.equal(await code(openSecret({ current: "s1", keys: { s1: newSealKey() } }, env, "tenant:t1")), "decrypt_failed");
  assert.equal(await code(openSecret(r, env.slice(0, -6), "tenant:t1")), "decrypt_failed");
  assert.equal(await code(openSecret(r, "plain-secret", "tenant:t1")), "bad_envelope");
  assert.equal(await code(openSecret(r, `tsl2.${p[1]}.${p[2]}.${p[3]}`, "tenant:t1")), "bad_envelope");
  assert.equal(await code(openSecret(r, `${p[0]}.zz.${p[2]}.${p[3]}`, "tenant:t1")), "unknown_key");
  assert.equal(await code(openSecret(r, `${p[0]}.__proto__.${p[2]}.${p[3]}`, "tenant:t1")), "unknown_key");
});
test("seal: key rotation keeps old envelopes openable; bad keys and empty secrets refused", async () => {
  const r = ring(), old = await sealSecret(r, "s3cret", "c");
  const r2: SealKeyring = { current: "s2", keys: { ...r.keys, s2: newSealKey() } };
  assert.equal(await openSecret(r2, old, "c"), "s3cret");
  assert.ok((await sealSecret(r2, "x", "c")).startsWith("tsl1.s2."));
  assert.equal(await code(sealSecret({ current: "s1", keys: { s1: b64u(new Uint8Array(16)) } }, "x", "c")), "bad_key");
  assert.equal(await code(sealSecret({ current: "s9", keys: {} }, "x", "c")), "unknown_key");
  assert.equal(await code(sealSecret(r, "", "c")), "empty_secret");
});
