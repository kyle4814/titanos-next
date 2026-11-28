// Test helpers. SYNTHETIC data only: fake D1 over node:sqlite (real SQLite, real constraints, our real migration), a fake R2 bucket,
// Stripe signing done with node:crypto per Stripe's documented scheme (independent of the code under test), a fake Stripe fetch.
// @ts-ignore node:sqlite has no types in @types/node 20 (portal-api tests do the same)
import { DatabaseSync } from "node:sqlite";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import type { D1Like, D1Statement, Env, R2Like } from "../src/env.ts";
import type { DigitalItem } from "../src/catalogue.ts";

export class FakeD1 implements D1Like {
  sql: DatabaseSync;
  constructor() { this.sql = new DatabaseSync(":memory:"); this.sql.exec(readFileSync(new URL("../migrations/0001_digital.sql", import.meta.url), "utf8")); }
  prepare(q: string): D1Statement {
    const self = this; let params: unknown[] = [];
    const stmt: D1Statement = {
      bind(...v) { params = v; return stmt; },
      async run() { const r = self.sql.prepare(q).run(...(params as any[])); return { meta: { changes: Number(r.changes) } }; },
      async first<T>() { return ((self.sql.prepare(q).get(...(params as any[])) as T | undefined) ?? null); },
      async all<T>() { return { results: self.sql.prepare(q).all(...(params as any[])) as T[] }; },
    };
    return stmt;
  }
}

export class FakeBucket implements R2Like {
  files = new Map<string, Uint8Array>(); gets = 0;
  async get(key: string) {
    this.gets++;
    const b = this.files.get(key); if (!b) return null;
    return { body: new Response(b as unknown as BodyInit).body, size: b.length, httpEtag: '"fake"' };
  }
}

export const WEBHOOK_SECRET = "whsec_test_fake_secret_for_unit_tests";
export const TOKEN_SECRET = "unit-test-token-secret-0123456789abcdef";
export const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...Array.from({ length: 200 }, (_, i) => i % 251)]);
export const ITEM: DigitalItem = { slug: "demo-pack", title: "Demo Pack", priceCents: 4900, r2Key: "products/demo-pack/demo-pack.zip", filename: "demo-pack.zip", bytes: ZIP.length, sha256: "x" };
export const ITEM2: DigitalItem = { slug: "other-pack", title: "Other Pack", priceCents: 2900, r2Key: "products/other-pack/other-pack.zip", filename: "other-pack.zip", bytes: ZIP.length, sha256: "y" };

// Stripe's documented signing: header "t=<unix>,v1=<hex HMAC-SHA256 over `${t}.${payload}` keyed by the endpoint secret>".
export function stripeSign(payload: string, secret: string, t: number): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex")}`;
}

export function completedEvent(o: { id?: string; session?: string; pi?: string; email?: string; slug?: string; paid?: boolean; livemode?: boolean; kind?: string; amount?: number; type?: string }) {
  return {
    id: o.id ?? "evt_test_1", object: "event", type: o.type ?? "checkout.session.completed", livemode: o.livemode ?? false,
    data: { object: {
      id: o.session ?? "cs_test_abc12345", object: "checkout.session", payment_status: o.paid === false ? "unpaid" : "paid",
      payment_intent: o.pi ?? "pi_test_1", amount_total: o.amount ?? 4900, currency: "aud", customer_details: { email: o.email ?? "Buyer@Example.com" },
      metadata: { kind: o.kind ?? "digital", slug: o.slug ?? "demo-pack" },
    } },
  };
}
export const refundEvent = (o: { id?: string; pi?: string; refunded?: boolean; amount?: number; amountRefunded?: number } = {}) => ({
  id: o.id ?? "evt_test_refund", type: "charge.refunded", livemode: false,
  data: { object: { id: "ch_test_1", object: "charge", payment_intent: o.pi ?? "pi_test_1", refunded: o.refunded ?? true, amount: o.amount ?? 4900, amount_refunded: o.amountRefunded ?? (o.amount ?? 4900) } },
});
export const disputeEvent = (o: { id?: string; pi?: string } = {}) => ({
  id: o.id ?? "evt_test_dispute", type: "charge.dispute.created", livemode: false,
  data: { object: { id: "dp_test_1", object: "dispute", charge: "ch_test_1", payment_intent: o.pi ?? "pi_test_1" } },
});

export function signedRequest(event: unknown, o: { now: number; secret?: string; url?: string; t?: number } = { now: 0 }): Request {
  const body = JSON.stringify(event);
  return new Request(o.url ?? "https://digital.test/digital/webhook", { method: "POST", body, headers: { "stripe-signature": stripeSign(body, o.secret ?? WEBHOOK_SECRET, o.t ?? Math.floor(o.now / 1000)), "content-type": "application/json" } });
}

export function makeEnv(db = new FakeD1(), bucket = new FakeBucket(), extra: Partial<Env> = {}): { env: Env; db: FakeD1; bucket: FakeBucket } {
  bucket.files.set(ITEM.r2Key, ZIP);
  bucket.files.set(ITEM2.r2Key, ZIP);
  return { db, bucket, env: {
    DB: db, DIGITAL_BUCKET: bucket, DIGITAL_STRIPE_MODE: "test", DIGITAL_STRIPE_SECRET_KEY: "sk_test_fake_key_for_unit_tests", DIGITAL_WEBHOOK_SECRET: WEBHOOK_SECRET,
    DIGITAL_TOKEN_SECRET: TOKEN_SECRET, SITE_ORIGIN: "https://titanos.tech", ...extra,
  } };
}

// A fake Stripe API: records requests, answers a Checkout Session.
export function fakeStripeFetch() {
  const calls: { url: string; headers: Record<string, string>; form: URLSearchParams }[] = [];
  const fetchFn = (async (url: string, init: any) => {
    calls.push({ url: String(url), headers: init.headers, form: new URLSearchParams(init.body) });
    const id = `cs_test_${String(calls.length).padStart(8, "0")}`;
    return new Response(JSON.stringify({ id, url: `https://checkout.stripe.test/c/pay/${id}` }), { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}
