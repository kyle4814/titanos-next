// STRIPE TEST-MODE HARNESS (x2_stripe_testmode, 2026-11-07).
// Drives the portal's own routes (/checkout, /stripe/webhook, /subscriptions/:id/cancel, /refunds) with the real StripeHttpBilling adapter.
//   keyed run   : STRIPE_TEST_SECRET (env, or ~/.titanos_env) must start with sk_test_; anything else is REFUSED (exit 2) and never echoed.
//                 Creates test products + prices from the portal catalogue, real test customers/PaymentIntents/subscriptions (pm_card_visa),
//                 a real test Checkout Session per product, then replays SIGNED webhook fixtures (checkout.session.completed carries the real ids).
//                 Hosted Checkout cannot be completed by API, so payment is made with pm_card_visa and the completed event is a signed fixture
//                 (or `stripe listen`/`stripe trigger` if stripe-cli is installed: not required).
//   no key      : runs the identical flow against FakeStripe (no network), labelled FIXTURE, and prints the CARD NEEDED line.
// Never run against live: live keys are refused. No deploy, no DNS, no email. Ids are written to acceptance/stripe_testmode_<mode>.json.
// Usage: node --experimental-strip-types scripts/stripe_testmode.ts [--out path] [--fixture]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname } from "node:path";
import { make, SECRET } from "../test/harness.ts";
import { PRODUCTS } from "../src/catalogue.ts";
import { StripeHttpBilling, signStripePayload } from "../src/stripe.ts";
import { FakeStripe } from "./stripe_fake.ts";

export const CARD_NEEDED = "CARD NEEDED: add a Stripe test-mode secret (sk_test_...) as STRIPE_TEST_SECRET=<key> in ~/.titanos_env (Stripe dashboard > Developers > API keys, Test mode toggle ON); then rerun `node --experimental-strip-types scripts/stripe_testmode.ts` in portal-api.";
const FIXTURE_KEY = "sk_test_FIXTURE_NOT_A_REAL_KEY";

export class KeyRefused extends Error { why: string; constructor(why: string) { super(why); this.why = why; } }
// Returns the key, or undefined when none is configured. Throws KeyRefused (never containing the value) for a present but non-sk_test_ key.
export function readTestKey(env: Record<string, string | undefined> = process.env, envFileText?: string): string | undefined {
  let v = env.STRIPE_TEST_SECRET;
  if (!v) {
    let txt = envFileText;
    if (txt === undefined) { try { txt = readFileSync(`${homedir()}/.titanos_env`, "utf8"); } catch { txt = ""; } }
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*(?:export\s+)?STRIPE_TEST_SECRET\s*=\s*(.*)\s*$/);
      if (m) { v = m[1].trim().replace(/^(['"])(.*)\1$/, "$2"); break; }
    }
  }
  if (!v) return undefined;
  if (!/^sk_test_[A-Za-z0-9]{8,}$/.test(v)) throw new KeyRefused("STRIPE_TEST_SECRET is not an sk_test_ key (live, restricted and malformed keys are refused)");
  return v;
}

type Fetch = typeof fetch;
class Stripe {   // minimal form client for the objects the portal does not create itself
  private key: string; private f: Fetch;
  constructor(key: string, f: Fetch) { this.key = key; this.f = f; }
  async post(path: string, body: Record<string, string>, idem?: string): Promise<any> {
    const r = await this.f(`https://api.stripe.com/v1/${path}`, { method: "POST", headers: { authorization: `Bearer ${this.key}`, "content-type": "application/x-www-form-urlencoded", ...(idem ? { "idempotency-key": idem } : {}) }, body: new URLSearchParams(body).toString() });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`stripe_${r.status}:${j?.error?.code ?? "unknown"} at ${path}`);
    return j;
  }
}

export interface Step { step: string; product?: string; ok: boolean; detail: string }
export interface HarnessResult {
  label: "FIXTURE (FakeStripe, no network)" | "STRIPE TEST MODE (api.stripe.com, sk_test_)";
  runId: string; steps: Step[]; ids: Record<string, Record<string, string>>; pass: boolean; failures: string[]; stripeCalls: number;
}

export async function runHarness(opts: { key: string; fetchFn: Fetch; fixture: boolean; runId?: string }): Promise<HarnessResult> {
  const runId = opts.runId ?? `x2-${Date.now().toString(36)}`;
  const s = new Stripe(opts.key, opts.fetchFn);
  const steps: Step[] = [], ids: Record<string, Record<string, string>> = {}, failures: string[] = [];
  const rec = (step: string, ok: boolean, detail: string, product?: string) => { steps.push({ step, product, ok, detail }); if (!ok) failures.push(`${step}${product ? ":" + product : ""} ${detail}`); };
  const h = make();
  h.deps.billing = new StripeHttpBilling(opts.key, "test", opts.fetchFn);   // the real adapter, test mode, injected fetch
  const { session, account } = await h.login(`x2-${runId}@x2stripe.com.au`);
  const dom = `x2-${runId.replace(/[^a-z0-9]/g, "")}.com.au`;
  await h.verifiedDomain(session, dom);

  // 1. products + prices (idempotent per run via idempotency keys)
  for (const p of Object.values(PRODUCTS)) {
    try {
      const prod = await s.post("products", { name: p.name, "metadata[catalogue_id]": p.id, "metadata[x2_run]": runId }, `${runId}-prod-${p.id}`);
      const price = await s.post("prices", { product: prod.id, unit_amount: String(p.amountCents), currency: "aud", ...(p.mode === "subscription" ? { "recurring[interval]": p.interval ?? "month" } : {}), "metadata[catalogue_id]": p.id }, `${runId}-price-${p.id}`);
      ids[p.id] = { product: prod.id, price: price.id };
      rec("stripe.product_price", price.unit_amount === p.amountCents, `${prod.id} ${price.id} AU$${(p.amountCents / 100).toFixed(2)}`, p.id);
    } catch (e) { rec("stripe.product_price", false, String((e as Error).message), p.id); }
  }

  // 2. checkout via the portal -> real adapter -> Stripe Checkout Session; then payment by API and a SIGNED completed event
  for (const p of Object.values(PRODUCTS)) {
    if (!ids[p.id]) continue;
    try {
      const r = await h.j(await h.req("POST", "/checkout", { token: session, body: { product: p.id, domain: p.needsVerifiedDomain ? dom : undefined } }));
      const purchase = [...h.store.purchases.values()].filter((x) => x.id === r.purchaseId)[0];
      const okC = !!purchase && typeof r.checkoutUrl === "string" && r.checkoutUrl.startsWith("https://checkout.stripe.com/");
      ids[p.id].checkoutSession = purchase?.checkoutId ?? "";
      rec("portal.checkout", okC, `${purchase?.checkoutId} ${r.checkoutUrl ?? JSON.stringify(r)}`, p.id);
      if (!okC) continue;
      const cus = await s.post("customers", { email: `x2-${runId}@x2stripe.com.au`, "metadata[x2_run]": runId }, `${runId}-cus-${p.id}`);
      let pi: string | undefined, sub: string | undefined;
      if (p.mode === "payment") {
        const x = await s.post("payment_intents", { amount: String(p.amountCents), currency: "aud", customer: cus.id, payment_method: "pm_card_visa", confirm: "true", "automatic_payment_methods[enabled]": "true", "automatic_payment_methods[allow_redirects]": "never" }, `${runId}-pi-${p.id}`);
        pi = x.id; ids[p.id].paymentIntent = pi!;
      } else {
        await s.post("payment_methods/pm_card_visa/attach", { customer: cus.id }).catch(() => undefined);   // already attached on replay is fine
        await s.post(`customers/${cus.id}`, { "invoice_settings[default_payment_method]": "pm_card_visa" }).catch(() => undefined);
        const x = await s.post("subscriptions", { customer: cus.id, "items[0][price]": ids[p.id].price, default_payment_method: "pm_card_visa", "metadata[x2_run]": runId }, `${runId}-sub-${p.id}`);
        sub = x.id; ids[p.id].subscription = sub!;
      }
      ids[p.id].customer = cus.id;
      const evObj = { id: purchase.checkoutId, payment_status: "paid", ...(pi ? { payment_intent: pi } : {}), customer: cus.id, ...(sub ? { subscription: sub } : {}), metadata: { account_id: account.id, product_id: p.id } };
      const w = await h.webhook("checkout.session.completed", evObj, { id: `evt_${runId}_${p.id}` });
      const wj: any = await w.json();
      rec("portal.webhook_completed", w.status === 200 && wj.result === "handled", `HTTP ${w.status} ${JSON.stringify(wj)}`, p.id);
      const after = h.store.purchases.get(purchase.id);
      rec("portal.purchase_paid_and_invoiced", after?.status === "paid" && (await h.store.invoicesFor(account.id)).some((i) => i.purchaseId === purchase.id), `status=${after?.status}`, p.id);
    } catch (e) { rec("portal.checkout_or_pay", false, String((e as Error).message), p.id); }
  }

  // 3. webhook hygiene: duplicate event id, bad signature, stale timestamp
  {
    const dupId = `evt_${runId}_${Object.keys(PRODUCTS)[0]}`;
    const dup = await h.webhook("checkout.session.completed", { id: ids[Object.keys(PRODUCTS)[0]]?.checkoutSession ?? "cs_x", payment_status: "paid" }, { id: dupId });
    rec("webhook.duplicate_event", ((await dup.json()) as any).result === "duplicate", "replay of a claimed event id", "all");
    const bad = await h.webhook("checkout.session.completed", { id: "cs_x", payment_status: "paid" }, { secret: "whsec_wrong" });
    rec("webhook.bad_signature_400", bad.status === 400, `HTTP ${bad.status}`, "all");
    const stale = await h.webhook("checkout.session.completed", { id: "cs_x", payment_status: "paid" }, { t: Math.floor(h.clock.t / 1000) - 3600 });
    rec("webhook.stale_timestamp_400", stale.status === 400, `HTTP ${stale.status}`, "all");
  }

  // 4. refund: compliance_pack is the only automatic one (terms: 14 days, no deliverable); monitor goes to a review card (no Stripe call)
  try {
    const cp = [...h.store.purchases.values()].find((x) => x.productId === "compliance_pack" && x.status === "paid");
    if (cp) {
      const r = await h.j(await h.req("POST", "/refunds", { token: session, body: { purchaseId: cp.id } }));
      const re = h.store.purchases.get(cp.id);
      rec("portal.refund_auto", r.status === "refunded" && re?.status === "refunded", `${JSON.stringify(r)}`, "compliance_pack");
    } else rec("portal.refund_auto", false, "no paid compliance_pack purchase to refund", "compliance_pack");
    const mp = [...h.store.purchases.values()].find((x) => x.productId === "monitor_monthly" && x.status === "paid");
    if (mp) {
      // FINDING F1 (real Stripe shape): a subscription-mode checkout.session.completed carries payment_intent=null (the PI lives on the first invoice),
      // so the purchase has no paymentIntent and /refunds answers 409 not_refundable_yet; the out-of-policy review card is never raised for subscriptions.
      // Asserted as the CURRENT behaviour so a fix flips this step red on purpose and the expectation is updated with it. Not fixed here (out of scope).
      const rr = await h.req("POST", "/refunds", { token: session, body: { purchaseId: mp.id } }); const r: any = await rr.json();
      rec("portal.refund_subscription_FINDING_F1", rr.status === 409 && r.error === "not_refundable_yet", `HTTP ${rr.status} ${JSON.stringify(r)} (subscription purchases have no paymentIntent; see PRICE_ALIGN/receipt F1)`, "monitor_monthly");
    }
  } catch (e) { rec("portal.refund", false, String((e as Error).message)); }

  // 5. cancel: monitor (period end) and a retainer (min-term), each calls Stripe cancel_at_period_end, then the deleted event is replayed signed
  for (const pid of ["monitor_monthly", "ai_growth"]) {
    try {
      const subId = ids[pid]?.subscription; if (!subId) { rec("portal.cancel", false, "no subscription id", pid); continue; }
      const r = await h.j(await h.req("POST", `/subscriptions/${subId}/cancel`, { token: session }));
      rec("portal.cancel_scheduled", r.status === "cancel_scheduled", JSON.stringify(r), pid);
      const w = await h.webhook("customer.subscription.deleted", { id: subId }, { id: `evt_${runId}_del_${pid}` });
      rec("portal.webhook_sub_deleted", ((await w.json()) as any).result === "handled" && !!(await h.store.subscriptionById(subId))?.cancelledAt, `HTTP ${w.status}`, pid);
    } catch (e) { rec("portal.cancel", false, String((e as Error).message), pid); }
  }

  const fake = opts.fetchFn as unknown as { __fake?: FakeStripe };
  return { label: opts.fixture ? "FIXTURE (FakeStripe, no network)" : "STRIPE TEST MODE (api.stripe.com, sk_test_)", runId, steps, ids, pass: failures.length === 0, failures, stripeCalls: fake.__fake?.calls.length ?? -1 };
}

export async function main(argv: string[]): Promise<number> {
  const i = argv.indexOf("--out");
  let key: string | undefined;
  try { key = readTestKey(); } catch (e) { if (e instanceof KeyRefused) { console.error("REFUSED: " + e.why); return 2; } throw e; }
  const fixture = !key || argv.includes("--fixture");
  let fetchFn: Fetch, fake: FakeStripe | undefined;
  if (fixture) { fake = new FakeStripe(); fetchFn = fake.fetch as Fetch; (fetchFn as any).__fake = fake; } else fetchFn = fetch;
  const res = await runHarness({ key: fixture ? FIXTURE_KEY : key!, fetchFn, fixture });
  if (fake) res.stripeCalls = fake.calls.length;
  const out = i >= 0 ? argv[i + 1] : new URL(`../acceptance/stripe_testmode_${fixture ? "fixture" : "test"}.json`, import.meta.url).pathname;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ ...res, note: "ids only; no secret is ever written" }, null, 2) + "\n");
  for (const s of res.steps) console.log(`${s.ok ? "ok  " : "FAIL"} ${s.step}${s.product ? " [" + s.product + "]" : ""} ${s.detail}`);
  console.log(`${res.label}: ${res.steps.filter((s) => s.ok).length}/${res.steps.length} steps ok, ${res.stripeCalls} stripe calls, ids -> ${out}`);
  if (!key) console.log(CARD_NEEDED);
  return res.pass ? 0 : 1;
}
if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2)).then((c) => process.exit(c));
