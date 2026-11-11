// f376 C2: TXT chunking and quoting through dohResolver into the verify decision. Offline: fetch is stubbed, synthetic data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { make } from "./harness.ts";
import { dohResolver } from "../src/dns.ts";

const doh = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as never;
const rec = (data: string, type = 16, name = "_TitanOS-Verify.Acme.com.au.") => ({ name, type, TTL: 60, data });
const answer = (...a: ReturnType<typeof rec>[]) => ({ Status: 0, Answer: a });
// Cloudflare/DNS presentation format: strings over 255 bytes are split into quoted 255-byte chunks separated by a space.
const chunked = (v: string, n = 255) => (v.match(new RegExp(`.{1,${n}}`, "g")) ?? []).map((c) => `"${c}"`).join(" ");

async function setup() {
  const h = make();
  const { session } = await h.login("a@acme.com.au");
  const d = await h.j(await h.req("POST", "/domains", { token: session, body: { domain: "acme.com.au" } }));
  return { h, session, d, tok: d.record.value as string };
}
// Wire the real dohResolver (stubbed fetch) into the live verify route.
async function verifyWith(body: unknown) {
  const { h, session, d, tok } = await setup();
  const r = dohResolver(doh(typeof body === "function" ? (body as (t: string) => unknown)(tok) : body));
  h.dns.txt = (n: string) => r.txt(n);
  const res = await h.req("POST", `/domains/${d.id}/verify`, { token: session });
  return { status: res.status, tok };
}
const body = (f: (t: string) => unknown) => f as unknown;

test("300-char value split into two quoted chunks (255 + rest) verifies", async () => {
  // titanos-verify= is 16 chars; token is whatever we issued, pad via a separate assertion on the resolver
  const { tok } = await setup();
  const long = tok + "z".repeat(300 - tok.length); // 300 chars, not our token: must NOT verify
  assert.equal(long.length, 300);
  const out = await dohResolver(doh(answer(rec(chunked(long))))).txt("n");
  assert.deepEqual(out, [long], "two chunks rejoin to the exact 300-char string");
  assert.equal(chunked(long).split('" "').length, 2);
  assert.equal(out.includes(tok), false, "a longer value containing the token is not a match");
});
test("real token delivered in two chunks (split mid-token) verifies end to end", async () => {
  const r = await verifyWith(body((t) => answer(rec(chunked(t, 10)))));
  assert.equal(r.status, 200);
  assert.ok(r.tok.length > 10, "token genuinely split into 2+ chunks");
});
test("single quoted value verifies", async () => assert.equal((await verifyWith(body((t) => answer(rec(`"${t}"`))))).status, 200));
test("space-separated chunk boundary at the key/value seam verifies", async () => {
  const r = await verifyWith(body((t) => answer(rec(`"titanos-verify=" "${t.slice("titanos-verify=".length)}"`))));
  assert.equal(r.status, 200);
});
test("mixed-case record name and trailing dot in the answer do not matter", async () => {
  assert.equal((await verifyWith(body((t) => answer(rec(`"${t}"`, 16, "_TITANOS-VERIFY.ACME.COM.AU."))))).status, 200);
});
test("CNAME record alongside the TXT answer is ignored, TXT still verifies", async () => {
  const r = await verifyWith(body((t) => answer(rec("alias.example.net.", 5), rec(`"${t}"`))));
  assert.equal(r.status, 200);
});
test("CNAME whose data looks like the token does NOT verify", async () => {
  assert.equal((await verifyWith(body((t) => answer(rec(`"${t}"`, 5))))).status, 422);
});
test("near-miss token (one char off, either end) does not verify", async () => {
  assert.equal((await verifyWith(body((t) => answer(rec(`"${t.slice(0, -1)}X"`))))).status, 422);
  assert.equal((await verifyWith(body((t) => answer(rec(`"${t.slice(0, -1)}"`))))).status, 422);
  assert.equal((await verifyWith(body((t) => answer(rec(`"${t}X"`))))).status, 422);
});
test("a chunk dropped from a multi-chunk value does not verify", async () => {
  assert.equal((await verifyWith(body((t) => answer(rec(`"${t.slice(0, 10)}"`))))).status, 422);
});
test("empty Answer array, missing Answer: not verified (422)", async () => {
  assert.equal((await verifyWith({ Status: 0, Answer: [] })).status, 422);
  assert.equal((await verifyWith({ Status: 0 })).status, 422);
});
test("NXDOMAIN (Status 3, no Answer) does not verify", async () => assert.equal((await verifyWith({ Status: 3, Question: [] })).status, 422));
test("Status != 0 with an Answer present fails closed (SERVFAIL/NXDOMAIN never verify)", async () => {
  assert.equal((await verifyWith(body((t) => ({ Status: 2, Answer: [rec(`"${t}"`)] })))).status, 422);
  assert.equal((await verifyWith(body((t) => ({ Status: 3, Answer: [rec(`"${t}"`)] })))).status, 422);
});
test("non-TXT records only (A, CNAME, MX) do not verify", async () => {
  assert.equal((await verifyWith(answer(rec("1.2.3.4", 1), rec("mail.acme.com.au.", 15), rec("x.example.net.", 5)))).status, 422);
});
test("resolver unit: escaped quotes and a bare empty string are preserved, not crashed on", async () => {
  assert.deepEqual(await dohResolver(doh(answer(rec('"a\\"b"')))).txt("n"), ['a\\"b']);
  assert.deepEqual(await dohResolver(doh(answer(rec('""')))).txt("n"), [""]);
});
test("resolver unit: three chunks join in order; two separate TXT records stay separate", async () => {
  assert.deepEqual(await dohResolver(doh(answer(rec('"aa" "bb" "cc"')))).txt("n"), ["aabbcc"]);
  assert.deepEqual(await dohResolver(doh(answer(rec('"aa"'), rec('"bb"')))).txt("n"), ["aa", "bb"]);
});
test("two separate TXT records that concatenate to the token do NOT verify (records are not joined)", async () => {
  assert.equal((await verifyWith(body((t) => answer(rec(`"${t.slice(0, 12)}"`), rec(`"${t.slice(12)}"`))))).status, 422);
});
