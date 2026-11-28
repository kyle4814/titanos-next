import { test } from "node:test";
import assert from "node:assert/strict";
import { DevOutboxMailer, ResendMailer, mailerFor, unavailableMailer } from "../src/mailer.ts";
import { DigitalStore } from "../src/store.ts";
import { FakeD1, makeEnv } from "./helpers.ts";

test("mailer: Resend adapter posts the right request with an idempotency key, and throws on a non-2xx", async () => {
  const seen: any[] = [];
  const ok = (async (u: string, i: any) => { seen.push({ u, i }); return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
  await new ResendMailer("re_fake", "TITANOS <orders@titanos.tech>", "kyle@titanos.tech", ok).send({ to: "a@b.co", subject: "S", text: "T", idempotencyKey: "digital-dp_1" });
  assert.equal(seen[0].u, "https://api.resend.com/emails");
  assert.equal(seen[0].i.headers["idempotency-key"], "digital-dp_1");
  assert.equal(seen[0].i.headers.authorization, "Bearer re_fake");
  assert.deepEqual(JSON.parse(seen[0].i.body), { from: "TITANOS <orders@titanos.tech>", to: ["a@b.co"], reply_to: "kyle@titanos.tech", subject: "S", text: "T" });
  const bad = (async () => new Response("no", { status: 422 })) as unknown as typeof fetch;
  await assert.rejects(() => new ResendMailer("re_fake", "f", "r", bad).send({ to: "a@b.co", subject: "S", text: "T", idempotencyKey: "k" }), /resend_422/);
});

test("mailer: selection. Resend when configured, dev outbox only in test mode, otherwise unavailable (webhook then 500s and retries)", async () => {
  const store = new DigitalStore(new FakeD1()); const now = () => 5;
  assert.ok(mailerFor({ RESEND_API_KEY: "k", MAIL_FROM: "f" }, store, now) instanceof ResendMailer);
  assert.ok(mailerFor({ DIGITAL_DEV_OUTBOX: "1", DIGITAL_STRIPE_MODE: "test" }, store, now) instanceof DevOutboxMailer);
  assert.equal(mailerFor({ DIGITAL_DEV_OUTBOX: "1", DIGITAL_STRIPE_MODE: "live" }, store, now), unavailableMailer, "the dev outbox can never run live");
  assert.equal(mailerFor({}, store, now), unavailableMailer);
  await assert.rejects(() => unavailableMailer.send({ to: "a", subject: "b", text: "c", idempotencyKey: "d" }), /mailer_unavailable/);
});

test("mailer: the dev outbox parks the message in D1", async () => {
  const { env, db } = makeEnv();
  await new DevOutboxMailer(new DigitalStore(env.DB!), () => 99).send({ to: "a@b.co", subject: "S", text: "T", idempotencyKey: "k" });
  assert.deepEqual({ ...(db.sql.prepare("SELECT to_addr, subject, body, created_at FROM digital_outbox").get() as object) }, { to_addr: "a@b.co", subject: "S", body: "T", created_at: 99 });
});
