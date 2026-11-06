import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.ts";
import type { Env } from "../src/env.ts";

const call = (path: string, env: Env, method = "GET") => worker.fetch(new Request("https://x.test" + path, { method }), env);
const okDb = { prepare: () => ({ bind() { return this; }, first: async () => ({ one: 1 }), run: async () => ({}), all: async () => ({ results: [] }) }) };
const badDb = { prepare: () => { throw new Error("boom"); } };

test("health: 200 with db ok and test mode by default", async () => {
  const r = await call("/health", { DB: okDb as never });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, service: "titanos-portal-api", version: "0.1.0", stripe_mode: "test", db: "ok" });
});
test("health: no DB bound is reported, not hidden", async () => {
  const b = await (await call("/health", {})).json() as { db: string; ok: boolean };
  assert.equal(b.db, "unconfigured");
  assert.equal(b.ok, true);
});
test("health: DB failure is 503, never a fake ok", async () => {
  const r = await call("/health", { DB: badDb as never });
  assert.equal(r.status, 503);
  assert.equal(((await r.json()) as { db: string }).db, "error");
});
test("health: stripe_mode is live only when exactly live", async () => {
  assert.equal(((await (await call("/health", { STRIPE_MODE: "live" })).json()) as { stripe_mode: string }).stripe_mode, "live");
  assert.equal(((await (await call("/health", { STRIPE_MODE: "LIVE " })).json()) as { stripe_mode: string }).stripe_mode, "test");
});
test("health: secrets never appear in the response", async () => {
  const t = await (await call("/health", { STRIPE_SECRET_KEY: "sk_test_SECRETVALUE", INTERNAL_API_SECRET: "hunter2" })).text();
  assert.ok(!t.includes("SECRETVALUE") && !t.includes("hunter2"));
});
test("routing: POST /health is 405, unknown path is 404 JSON", async () => {
  assert.equal((await call("/health", {}, "POST")).status, 405);
  const r = await call("/nope", {});
  assert.equal(r.status, 404);
  assert.deepEqual(await r.json(), { error: "not_found", path: "/nope" });
});
