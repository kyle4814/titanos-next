// register_stripe_webhook.mjs: driven ONLY with a stubbed fetch and a stubbed wrangler runner. No Stripe call, no wrangler call.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { run, EVENTS, WEBHOOK_PATH } from "../scripts/register_stripe_webhook.mjs";

const KEY = "rk" + "_live_" + "FAKE0000", SECRET = "whsec" + "_FAKESECRET0000", HOST = "portal-api.titanos.tech", URL_ = `https://${HOST}/stripe/webhook`;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
function rig(responses: Array<Response | (() => Response)>, env: Record<string, string> = { STRIPE_SECRET_KEY: KEY }) {
  const calls: { url: string; method: string; auth: string; body?: string }[] = [], puts: string[] = [], out: string[] = [], err: string[] = [];
  const fetchFn = (async (url: string, init: any) => { calls.push({ url, method: init.method, auth: init.headers.authorization, body: init.body }); const r = responses.shift(); if (!r) throw new Error("unexpected extra call"); return typeof r === "function" ? r() : r; }) as any;
  const deps = { env, fetchFn, putSecret: async (s: string) => { puts.push(s); return 0; }, out: (l: string) => out.push(l), err: (l: string) => err.push(l) };
  return { calls, puts, out, err, go: (argv: string[]) => run(argv, deps) };
}
const ARGS = ["--hostname", HOST, "--confirm-live", HOST];
const noLeak = (r: { out: string[]; err: string[] }) => { const all = [...r.out, ...r.err].join("\n"); assert.ok(!all.includes(KEY) && !all.includes(SECRET) && !all.includes("FAKE0000"), "key or secret leaked to output"); };

test("empty list then create: posts the exact URL and events, secret goes only to the wrangler runner, nothing leaks", async () => {
  const r = rig([json({ data: [], has_more: false }), json({ id: "we_1", secret: SECRET })]);
  assert.equal(await r.go(ARGS), 0);
  assert.equal(r.calls[0].method, "GET"); assert.match(r.calls[0].url, /webhook_endpoints\?limit=100$/); assert.equal(r.calls[0].auth, "Bearer " + KEY);
  assert.equal(r.calls[1].method, "POST");
  const body = new URLSearchParams(r.calls[1].body);
  assert.equal(body.get("url"), URL_); assert.deepEqual(body.getAll("enabled_events[]"), EVENTS);
  assert.deepEqual(r.puts, [SECRET]); noLeak(r);
});
test("existing endpoint on the same URL (also on page 2): reused, no create, no secret written", async () => {
  const r = rig([json({ data: [{ id: "we_a", url: "https://other.example/x" }], has_more: true }), json({ data: [{ id: "we_b", url: URL_, enabled_events: ["charge.refunded"] }], has_more: false })]);
  assert.equal(await r.go(ARGS), 0);
  assert.equal(r.calls.length, 2); assert.ok(r.calls.every((c) => c.method === "GET")); assert.match(r.calls[1].url, /starting_after=we_a/);
  assert.deepEqual(r.puts, []); assert.ok(r.out.join("\n").includes("already registered (id we_b)")); assert.ok(r.out.join("\n").includes("missing events")); noLeak(r);
});
test("403 on list or create: names the missing Stripe permission, exits non-zero, writes nothing", async () => {
  for (const second of [false, true]) {
    const r = rig(second ? [json({ data: [], has_more: false }), json({ error: { message: "key rk_live_...FAKE0000" } }, 403)] : [json({ error: { message: "Invalid API Key provided: " + KEY } }, 401)]);
    assert.equal(await r.go(ARGS), 3); assert.match(r.err.join("\n"), /Webhook Endpoints: Write/); assert.deepEqual(r.puts, []); noLeak(r);
  }
});
test("non-live key is refused before any request", async () => {
  for (const k of ["sk" + "_test_FAKE0000", "rk" + "_test_FAKE0000", "nonsense"]) {
    const r = rig([], { STRIPE_SECRET_KEY: k }); assert.equal(await r.go(ARGS), 2); assert.equal(r.calls.length, 0); assert.match(r.err.join(""), /not a live key/);
  }
  const none = rig([], {}); assert.equal(await none.go(ARGS), 2); assert.equal(none.calls.length, 0);
});
test("--confirm-live missing or not matching the hostname is refused before any request", async () => {
  for (const argv of [["--hostname", HOST], ["--hostname", HOST, "--confirm-live", "api.titanos.tech"], ["--hostname", "not a host", "--confirm-live", "not a host"], ["--confirm-live", HOST]]) {
    const r = rig([]); assert.equal(await r.go(argv), 2); assert.equal(r.calls.length, 0);
  }
});
test("--key-env reads the named variable and still never prints it", async () => {
  const r = rig([json({ data: [], has_more: false }), json({ id: "we_2", secret: SECRET })], { MY_KEY: KEY });
  assert.equal(await r.go([...ARGS, "--key-env", "MY_KEY"]), 0); assert.equal(r.calls[0].auth, "Bearer " + KEY); noLeak(r);
  assert.equal(await rig([], { MY_KEY: KEY }).go([...ARGS, "--key-env", "bad name"]), 2);
});
test("--dry-run sends nothing, needs no key, masks everything", async () => {
  const r = rig([], {}); assert.equal(await r.go([...ARGS, "--dry-run"]), 0);
  assert.equal(r.calls.length, 0); const o = r.out.join("\n"); assert.ok(o.includes(URL_) && o.includes("Bearer ****") && o.includes("whsec_****")); noLeak(r);
  assert.equal(await rig([], {}).go(["--hostname", HOST, "--dry-run"]), 2, "dry run still demands the host confirmation");
});
test("wrangler failure after create reports the endpoint and the manual recovery, exit 5, no secret printed", async () => {
  const out: string[] = [], err: string[] = []; let n = 0;
  const fetchFn = (async () => (++n === 1 ? json({ data: [], has_more: false }) : json({ id: "we_3", secret: SECRET }))) as any;
  assert.equal(await run(ARGS, { env: { STRIPE_SECRET_KEY: KEY }, fetchFn, putSecret: async () => 1, out: (l: string) => out.push(l), err: (l: string) => err.push(l) }), 5);
  assert.match(err.join(""), /we_3/); noLeak({ out, err });
});
test("the event list equals the event types the handlers consume, and the path equals the served route", () => {
  const src = (f: string) => readFileSync(fileURLToPath(new URL("../src/" + f, import.meta.url)), "utf8");
  const found = new Set<string>();
  for (const f of ["service.ts", "agent/credits.ts", "index.ts", "plan_change_service.ts", "reconcile.ts"]) for (const m of src(f).matchAll(/\btype\s*===\s*"([a-z_]+(?:\.[a-z_]+)+)"/g)) found.add(m[1]);
  assert.deepEqual([...found].sort(), [...EVENTS].sort());
  assert.ok(src("index.ts").includes(`path === "${WEBHOOK_PATH}"`));
});
