// C2 hardening: DNS TXT ownership. Synthetic data only; no live DNS (fetch is injected).
import { test } from "node:test";
import assert from "node:assert/strict";
import { make } from "./harness.ts";
import { normaliseDomain, verifyRecordName, verifyRecordValue, dohResolver, fakeResolver } from "../src/dns.ts";

const doh = (body: unknown, status = 200) => (async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status })) as never;
const ans = (...data: string[]) => ({ Status: 0, Answer: data.map((d) => ({ name: "x", type: 16, TTL: 60, data: d })) });

// ---------- normaliseDomain ----------
test("normalise: accepts plain, uppercase, trailing dot, scheme+path, whitespace-trimmed", () => {
  assert.equal(normaliseDomain("Acme.COM.au"), "acme.com.au");
  assert.equal(normaliseDomain("acme.com.au."), "acme.com.au");
  assert.equal(normaliseDomain("  acme.com.au \n"), "acme.com.au");
  assert.equal(normaliseDomain("https://Acme.com.au/path?q=1"), "acme.com.au");
  assert.equal(normaliseDomain("sub.acme.com.au"), "sub.acme.com.au");
});
test("normalise: punycode xn-- labels pass, raw unicode IDN fails closed, xn-- TLD fails closed", () => {
  assert.equal(normaliseDomain("xn--bcher-kva.example.com"), "xn--bcher-kva.example.com");
  assert.equal(normaliseDomain("bücher.example.com"), null);
  assert.equal(normaliseDomain("例え.jp"), null);
  assert.equal(normaliseDomain("acme.xn--p1ai"), null, "TLD must be letters only (documented fail-closed)");
});
test("normalise: 63-char label ok, 64 rejected; 253 total ok, 254 rejected", () => {
  const l63 = "a".repeat(63);
  assert.equal(normaliseDomain(`${l63}.com`), `${l63}.com`);
  assert.equal(normaliseDomain(`${"a".repeat(64)}.com`), null);
  // 63,63,63,57 + 3 dots + ".com" = 253; 58 in the last label = 254 (label limit untouched)
  const d253 = [l63, l63, l63, "c".repeat(57)].join(".") + ".com", d254 = [l63, l63, l63, "c".repeat(58)].join(".") + ".com";
  assert.equal(d253.length, 253);
  assert.equal(normaliseDomain(d253), d253);
  assert.equal(normaliseDomain(d254), null);
});
test("normalise: userinfo, port, inner whitespace/control chars, empty labels, hyphen edges rejected", () => {
  for (const bad of ["user@acme.com.au", "https://user:pw@acme.com.au", "acme.com.au:8080", "https://acme.com.au:443/x", "acme\t.com.au", "ac\nme.com.au", "acme.com.au\n.evil.com", "acme..com.au", "acme.com.au..", ".acme.com.au", "-acme.com.au", "acme-.com.au", "ac me.com.au", "acme.com.au/../x@evil.com"]) {
    const r = normaliseDomain(bad);
    if (bad === "acme.com.au/../x@evil.com") assert.equal(r, "acme.com.au", "path stripped, host unchanged");
    else assert.equal(r, null, JSON.stringify(bad));
  }
});
test("normalise: reserved TLDs, IPv4, IPv6, non-strings rejected", () => {
  for (const bad of ["a.localhost", "a.local", "a.internal", "a.test", "a.invalid", "a.example", "localhost", "127.0.0.1", "10.0.0.1", "[::1]", "::1", "2001:db8::1", "http://[2001:db8::1]/", "com", "", "   "]) assert.equal(normaliseDomain(bad), null, bad);
  for (const bad of [undefined, null, 5, {}, [], ["a.com"]]) assert.equal(normaliseDomain(bad), null);
});
test("record name/value shape", () => {
  assert.equal(verifyRecordName("acme.com.au"), "_titanos-verify.acme.com.au");
  assert.equal(verifyRecordValue("v_abc"), "titanos-verify=v_abc");
});

// ---------- dohResolver ----------
test("doh: NXDOMAIN (Status 3), empty Answer and missing Answer give []", async () => {
  assert.deepEqual(await dohResolver(doh({ Status: 3 })).txt("n"), []);
  assert.deepEqual(await dohResolver(doh({ Status: 0, Answer: [] })).txt("n"), []);
  assert.deepEqual(await dohResolver(doh({})).txt("n"), []);
});
test("doh: non-TXT answer types filtered (CNAME 5, A 1)", async () => {
  const b = { Answer: [{ type: 5, data: "other.example.com." }, { type: 1, data: "1.2.3.4" }, { type: 16, data: '"titanos-verify=tok"' }] };
  assert.deepEqual(await dohResolver(doh(b)).txt("n"), ["titanos-verify=tok"]);
});
test("doh: multi-string TXT chunks are joined; quoted edge cases", async () => {
  assert.deepEqual(await dohResolver(doh(ans('"titanos-verify=" "abc123"'))).txt("n"), ["titanos-verify=abc123"]);
  assert.deepEqual(await dohResolver(doh(ans('"a" "b" "c"'))).txt("n"), ["abc"]);
  assert.deepEqual(await dohResolver(doh(ans("titanos-verify=bare"))).txt("n"), ["titanos-verify=bare"], "unquoted passes through");
  assert.deepEqual(await dohResolver(doh(ans('""'))).txt("n"), [""]);
  assert.deepEqual(await dohResolver(doh(ans('"v=spf1 -all"', '"titanos-verify=t"'))).txt("n"), ["v=spf1 -all", "titanos-verify=t"]);
});
test("doh: non-JSON body, 4xx, 5xx, fetch reject all reject (fail closed)", async () => {
  await assert.rejects(dohResolver(doh("<html>")).txt("n"));
  await assert.rejects(dohResolver(doh({}, 400)).txt("n"), /doh_400/);
  await assert.rejects(dohResolver(doh({}, 503)).txt("n"), /doh_503/);
  await assert.rejects(dohResolver((async () => { throw new TypeError("network"); }) as never).txt("n"), /network/);
});
test("doh: query is name-encoded, type TXT, JSON accept header, abort signal attached", async () => {
  let url = "", init: RequestInit | undefined;
  await dohResolver((async (u: string, i: RequestInit) => { url = u; init = i; return new Response("{}"); }) as never).txt("_titanos-verify.a.com&x=1");
  assert.match(url, /name=_titanos-verify\.a\.com%26x%3D1&type=TXT$/);
  assert.equal((init!.headers as Record<string, string>).accept, "application/dns-json");
  assert.ok(init!.signal instanceof AbortSignal);
});
test("doh: a never-resolving fetch rejects within the budget (injectable timeout)", async () => {
  const t0 = Date.now();
  await assert.rejects(dohResolver((() => new Promise(() => {})) as never, { timeoutMs: 60 }).txt("n"), /doh_timeout/);
  assert.ok(Date.now() - t0 < 1000, "rejected near the 60 ms budget");
});
test("doh: a body that never finishes also times out; abort signal fires", async () => {
  let sig: AbortSignal | undefined;
  const f = (async (_u: string, i: RequestInit) => { sig = i.signal as AbortSignal; return { ok: true, status: 200, json: () => new Promise(() => {}) } as unknown as Response; }) as never;
  await assert.rejects(dohResolver(f, { timeoutMs: 40 }).txt("n"), /doh_timeout/);
  assert.equal(sig!.aborted, true);
});
test("doh: a fast answer is not cut off, default budget is 3000 ms", async () => {
  assert.deepEqual(await dohResolver(doh(ans('"x"')), { timeoutMs: 500 }).txt("n"), ["x"]);
  const src = await import("../src/dns.ts");
  assert.equal(src.DOH_TIMEOUT_MS, 3000);
});

// ---------- verify decision (service.ts) ----------
async function setup(domain = "acme.com.au") {
  const h = make();
  const { session, account } = await h.login("a@acme.com.au");
  const d = await h.j(await h.req("POST", "/domains", { token: session, body: { domain } }));
  return { h, session, account, d };
}
const verify = (h: any, session: string, id: string) => h.req("POST", `/domains/${id}/verify`, { token: session });

test("verify: exact token match; case-differing token fails, extra TXT values ignored", async () => {
  const { h, session, d } = await setup();
  const tok = d.record.value as string;
  h.dns.zone[d.record.name] = [tok.toUpperCase()];
  assert.equal((await verify(h, session, d.id)).status, 422, "token is case-sensitive");
  h.dns.zone[d.record.name] = [tok + "x"];
  assert.equal((await verify(h, session, d.id)).status, 422, "superstring is not a match");
  h.dns.zone[d.record.name] = [" " + tok];
  assert.equal((await verify(h, session, d.id)).status, 422, "padded is not a match");
  h.dns.zone[d.record.name] = ["v=spf1 -all", "google-site-verification=zzz", tok, "other"];
  const ok = await h.j(await verify(h, session, d.id));
  assert.equal(ok.verified, true);
});
test("verify: parent-domain record never verifies a subdomain, and vice versa", async () => {
  const { h, session, d } = await setup("sub.acme.com.au");
  h.dns.zone["_titanos-verify.acme.com.au"] = [d.record.value];
  assert.equal((await verify(h, session, d.id)).status, 422, "parent record does not verify subdomain");
  const { h: h2, session: s2, d: d2 } = await setup("acme.com.au");
  h2.dns.zone["_titanos-verify.sub.acme.com.au"] = [d2.record.value];
  assert.equal((await verify(h2, s2, d2.id)).status, 422, "subdomain record does not verify parent");
  assert.equal(d.record.name, "_titanos-verify.sub.acme.com.au");
});
test("verify: a token issued for another domain does not verify this one", async () => {
  const { h, session, d } = await setup();
  const d2 = await h.j(await h.req("POST", "/domains", { token: session, body: { domain: "other.com.au" } }));
  h.dns.zone[d.record.name] = [d2.record.value];
  assert.equal((await verify(h, session, d.id)).status, 422);
});
test("verify: two accounts cannot both own one domain, even with both tokens published", async () => {
  const h = make();
  const a = await h.login("a@acme.com.au"), b = await h.login("b@evil.com.au");
  const ad = await h.j(await h.req("POST", "/domains", { token: a.session, body: { domain: "acme.com.au" } }));
  const bd = await h.j(await h.req("POST", "/domains", { token: b.session, body: { domain: "acme.com.au" } }));
  h.dns.zone[ad.record.name] = [ad.record.value, bd.record.value];
  assert.equal((await verify(h, a.session, ad.id)).status, 200);
  assert.equal((await verify(h, b.session, bd.id)).status, 409);
  assert.equal((await h.req("POST", "/domains", { token: b.session, body: { domain: "ACME.com.au." } })).status, 201, "b keeps own unverified row");
  const c = await h.login("c@x.com.au");
  assert.equal((await h.req("POST", "/domains", { token: c.session, body: { domain: "Acme.com.au" } })).status, 409, "normalised form cannot dodge the owner check");
});
test("verify: resolver stall, throw and garbage fail closed as 502, never 500, never verified", async () => {
  const { h, session, d } = await setup();
  h.deps.dns = dohResolver((() => new Promise(() => {})) as never, { timeoutMs: 50 });
  assert.equal((await verify(h, session, d.id)).status, 502);
  h.deps.dns = dohResolver(doh("not json"));
  assert.equal((await verify(h, session, d.id)).status, 502);
  h.deps.dns = dohResolver((async () => { throw new Error("boom"); }) as never);
  assert.equal((await verify(h, session, d.id)).status, 502);
  h.deps.dns = fakeResolver({ [d.record.name]: [d.record.value] });
  assert.equal((await verify(h, session, d.id)).status, 200, "recovers once DNS answers");
});
test("verify: end to end through dohResolver with injected fetch (chunked TXT)", async () => {
  const { h, session, d } = await setup();
  const [pre, post] = [d.record.value.slice(0, 10), d.record.value.slice(10)];
  h.deps.dns = dohResolver(doh(ans(`"${pre}" "${post}"`)));
  const ok = await h.j(await verify(h, session, d.id));
  assert.equal(ok.verified, true);
});
