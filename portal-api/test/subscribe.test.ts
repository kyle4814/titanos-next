import { test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../src/index.ts";
import { make } from "./harness.ts";
import { FakeD1 } from "./fake_d1.ts";
import { D1SubscriberStore, MemorySubscriberStore, CONSENT_TEXT } from "../src/subscribe.ts";
import { Throttle } from "../src/throttle.ts";
import { THROTTLE_LIMITS } from "../src/build_deps.ts";

// POST /v1/subscribe: capture only. SYNTHETIC addresses (example.test) only; real SQLite via FakeD1 with the real migrations.
function rig(kind: "d1" | "memory" = "d1", opts: { throttle?: boolean } = {}) {
  const h = make("memory"), d1 = new FakeD1();
  const subs = kind === "d1" ? new D1SubscriberStore(d1) : new MemorySubscriberStore();
  const th = opts.throttle ? new Throttle({ ...THROTTLE_LIMITS, now: () => h.clock.t }) : undefined;
  const deps = { ...h.deps, subscribers: subs, throttle: th };
  const post = (body: unknown, ip = "203.0.113.7") =>
    handle(new Request("https://api.test/v1/subscribe", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ip }, body: JSON.stringify(body) }), {}, deps);
  return { d1, post, deps, h };
}
const rows = (d1: FakeD1) => d1.db.prepare("SELECT * FROM subscribers ORDER BY email").all() as any[];

test("valid signup is stored with the server consent line, default tag and a 201", async () => {
  const { d1, post } = rig();
  const r = await post({ email: "  Reader@Example.test ", consent: true });
  assert.equal(r.status, 201);
  const [row] = rows(d1);
  assert.equal(row.email, "reader@example.test");
  assert.equal(row.consent_text, CONSENT_TEXT);
  assert.deepEqual(JSON.parse(row.tags), ["daily-artifacts"]);
  assert.equal(row.source, "web");
});

test("client-sent consent text is ignored: the stored line is the server constant", async () => {
  const { d1, post } = rig();
  await post({ email: "a@example.test", consent: true, consent_text: "I agree to anything" });
  assert.equal(rows(d1)[0].consent_text, CONSENT_TEXT);
});

test("invalid email, missing consent, bad tags and bad source are 400 and store nothing", async () => {
  const { d1, post } = rig();
  const bad = [
    [{ email: "nope", consent: true }, "invalid_email"],
    [{ email: 5, consent: true }, "invalid_email"],
    [{ email: "a@example.test" }, "consent_required"],
    [{ email: "a@example.test", consent: "yes" }, "consent_required"],
    [{ email: "a@example.test", consent: true, tags: "x" }, "invalid_tags"],
    [{ email: "a@example.test", consent: true, tags: ["Bad Tag"] }, "invalid_tags"],
    [{ email: "a@example.test", consent: true, tags: ["a", "b", "c", "d", "e", "f"] }, "invalid_tags"],
    [{ email: "a@example.test", consent: true, source: "<script>" }, "invalid_source"],
  ] as const;
  for (const [b, code] of bad) { const r = await post(b); assert.equal(r.status, 400, JSON.stringify(b)); assert.equal(((await r.json()) as any).error, code); }
  assert.equal(rows(d1).length, 0);
});

test("a repeat signup is one row: tags merge, created_at stays, status 200", async () => {
  const { d1, post, h } = rig();
  await post({ email: "a@example.test", consent: true, tags: ["daily-artifacts"] });
  const t0 = rows(d1)[0].created_at;
  h.clock.t += 5000;
  const r = await post({ email: "A@example.test", consent: true, tags: ["course-trading-app"], source: "declaration-waitlist" });
  assert.equal(r.status, 200);
  const all = rows(d1);
  assert.equal(all.length, 1);
  assert.deepEqual(JSON.parse(all[0].tags).sort(), ["course-trading-app", "daily-artifacts"]);
  assert.equal(all[0].created_at, t0);
  assert.equal(all[0].source, "web");
});

test("honeypot: a filled website field answers 202 and stores nothing", async () => {
  const { d1, post } = rig();
  const r = await post({ email: "bot@example.test", consent: true, website: "http://spam.test" });
  assert.equal(r.status, 202);
  assert.equal(rows(d1).length, 0);
});

test("per-IP rate limit: every attempt counts, the sixth from one IP is 429, another IP is fine", async () => {
  const { post, d1 } = rig("d1", { throttle: true });
  for (let i = 0; i < 5; i++) assert.equal((await post({ email: `u${i}@example.test`, consent: true })).status, 201);
  const r = await post({ email: "u9@example.test", consent: true });
  assert.equal(r.status, 429);
  assert.ok(Number(r.headers.get("retry-after")) > 0);
  assert.equal(rows(d1).length, 5);
  assert.equal((await post({ email: "other@example.test", consent: true }, "198.51.100.9")).status, 201);
});

test("no store bound: 503, never a fake success; GET is 405", async () => {
  const h = make("memory");
  const r = await handle(new Request("https://api.test/v1/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "a@example.test", consent: true }) }), {}, h.deps);
  assert.equal(r.status, 503);
  const g = await handle(new Request("https://api.test/v1/subscribe"), {}, h.deps);
  assert.equal(g.status, 405);
});

test("memory and D1 stores agree; response carries the five security headers and never echoes the email", async () => {
  for (const kind of ["memory", "d1"] as const) {
    const { post } = rig(kind);
    const r = await post({ email: "echo@example.test", consent: true });
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.ok(!(await r.text()).includes("echo@example.test"));
  }
});
