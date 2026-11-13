// Relay transport: login mail through a service binding to the old titanos-api Worker. Stubbed binding only; no network, no old-Worker call.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FakeD1 } from "./fake_d1.ts";
import { MemoryStore } from "../src/store.ts";
import { buildDeps, mailerFor } from "../src/build_deps.ts";
import { StripeHttpBilling } from "../src/stripe.ts";
import { ResendMailer, RelayMailer, RELAY_PATH } from "../src/mail.ts";
import { createWorker } from "../src/index.ts";

const ORIGIN = "https://titanos.tech";
const factory = () => new MemoryStore();
const relaySecret = "relay" + "_FAKE0000";
const binding = (res: () => Response | Promise<Response>, seen: Request[] = []) => ({ fetch: async (r: Request) => { seen.push(r); return res(); } });
const liveRelayEnv = (extra: Record<string, unknown> = {}) => ({
  DB: new FakeD1() as never, TITANOS_SITE_ORIGIN: ORIGIN, STRIPE_MODE: "live", STRIPE_SECRET_KEY: "rk" + "_live_FAKE0000", STRIPE_WEBHOOK_SECRET: "whsec" + "_FAKE0000",
  MAIL_PROVIDER: "relay", MAIL_RELAY: binding(() => new Response("{}")), MAIL_RELAY_SECRET: relaySecret, LIVE_BILLING_ARMED: "yes-2026-11-13", ...extra,
});

test("relay: posts plain JSON {to, subject, text} with the bearer secret to the relay path, nothing else", async () => {
  const seen: Request[] = [];
  await new RelayMailer(binding(() => new Response('{"ok":true}'), seen), relaySecret).send("u@x.example", "Subj", "link text");
  const r = seen[0];
  assert.equal(r.method, "POST"); assert.equal(new URL(r.url).pathname, RELAY_PATH); assert.equal(r.headers.get("authorization"), "Bearer " + relaySecret);
  assert.deepEqual(await r.json(), { to: "u@x.example", subject: "Subj", text: "link text" });
  assert.ok(r.signal instanceof AbortSignal, "every send carries a timeout signal");
});
test("relay: 401/4xx -> 502 mail_rejected; 429/5xx, a throwing binding and a timeout -> 503 mail_unavailable", async () => {
  const send = (b: any, t = 8000) => new RelayMailer(b, relaySecret, t).send("u@x.example", "s", "t");
  await assert.rejects(send(binding(() => new Response("{}", { status: 401 }))), (e: any) => e.status === 502 && e.code === "mail_rejected");
  await assert.rejects(send(binding(() => new Response("{}", { status: 400 }))), (e: any) => e.status === 502);
  await assert.rejects(send(binding(() => new Response("{}", { status: 429 }))), (e: any) => e.status === 503 && e.code === "mail_unavailable");
  await assert.rejects(send(binding(() => new Response("{}", { status: 500 }))), (e: any) => e.status === 503);
  await assert.rejects(send({ fetch: async () => { throw new TypeError("binding down"); } }), (e: any) => e.status === 503);
  // AbortSignal.timeout is unref'd in Node, so the stub holds a ref'd timer until the abort fires.
  const hang = { fetch: (r: Request) => new Promise<Response>((_res, rej) => { const k = setTimeout(() => {}, 5000); r.signal.addEventListener("abort", () => { clearTimeout(k); rej(new Error("aborted")); }); }) };
  await assert.rejects(send(hang, 20), (e: any) => e.status === 503 && e.code === "mail_unavailable");
});
test("relay: mailerFor builds it; a missing binding or secret is named; resend stays selectable", () => {
  const base = { DB: new FakeD1() as never, TITANOS_SITE_ORIGIN: ORIGIN, MAIL_PROVIDER: "relay" };
  assert.ok(mailerFor({ ...base, MAIL_RELAY: binding(() => new Response("{}")), MAIL_RELAY_SECRET: "s" } as any, Date.now) instanceof RelayMailer);
  assert.throws(() => mailerFor({ ...base, MAIL_RELAY_SECRET: "s" } as any, Date.now), (e: any) => e.reason === "missing_binding" && e.binding === "MAIL_RELAY");
  assert.throws(() => mailerFor({ ...base, MAIL_RELAY: binding(() => new Response("{}")), MAIL_RELAY_SECRET: " " } as any, Date.now), (e: any) => e.binding === "MAIL_RELAY_SECRET");
  assert.ok(mailerFor({ ...base, MAIL_PROVIDER: "resend", RESEND_API_KEY: "k", MAIL_FROM: "f@x.example" } as any, Date.now) instanceof ResendMailer);
});
test("relay: live mode arms with the relay and NO Resend key or MAIL_FROM; missing relay parts block arming by name", () => {
  const d = buildDeps(liveRelayEnv(), { storeFactory: factory });
  assert.ok(d.mailer instanceof RelayMailer); assert.ok(d.billing instanceof StripeHttpBilling);
  for (const [patch, name] of [[{ MAIL_RELAY: undefined }, "MAIL_RELAY"], [{ MAIL_RELAY_SECRET: undefined }, "MAIL_RELAY_SECRET"]] as const) {
    try { buildDeps(liveRelayEnv(patch), { storeFactory: factory }); assert.fail("started"); }
    catch (e: any) { assert.equal(e.reason, "live_not_armed"); assert.ok(e.binding.split(",").includes(name), e.binding); }
  }
});
test("relay: login request end to end returns 202 and the relay gets only the login-link mail; a relay failure is a retryable 503", async () => {
  const seen: Request[] = []; let status = 200;
  const b = binding(() => new Response("{}", { status }), seen);
  const w = createWorker({ buildDeps: (e) => buildDeps(e, { storeFactory: factory }) });
  const env = { DB: new FakeD1() as never, TITANOS_SITE_ORIGIN: ORIGIN, MAIL_PROVIDER: "relay", MAIL_RELAY: b, MAIL_RELAY_SECRET: relaySecret };
  const post = () => w.fetch(new Request("https://api.test/auth/request", { method: "POST", body: JSON.stringify({ email: "u@x.example" }) }), env as any);
  assert.equal((await post()).status, 202);
  const sent = (await seen[0].json()) as any;
  assert.equal(sent.subject, "Your TITANOS login link");
  assert.match(sent.text, /^Open this link within 15 minutes to sign in:\nhttps:\/\/titanos\.tech\/app\/login#token=ll_[0-9a-f]+\nIf you did not ask for this, ignore it\.$/);
  status = 503; const r = await post(); assert.equal(r.status, 503); assert.deepEqual(await r.json(), { error: "mail_unavailable" });
});
