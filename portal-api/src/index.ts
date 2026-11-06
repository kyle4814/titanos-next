import type { Env } from "./env.ts";
import * as svc from "./service.ts";
import { HttpError, type Deps } from "./service.ts";
import { verifyStripeSignature } from "./stripe.ts";
import { PRODUCTS } from "./catalogue.ts";
import { entRoute } from "./enterprise/routes.ts";
import { runPayoutTick, type TickResult } from "./enterprise/payout_tick.ts";

export const SERVICE = "titanos-portal-api";
export const VERSION = "0.1.0";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

// GET /health: liveness plus a database probe. Reports only booleans and the Stripe MODE, never a secret value.
export async function health(env: Env): Promise<Response> {
  let db: "ok" | "unconfigured" | "error" = "unconfigured";
  if (env.DB) {
    try {
      await env.DB.prepare("SELECT 1 AS one").first();
      db = "ok";
    } catch {
      db = "error";
    }
  }
  const mode = env.STRIPE_MODE === "live" ? "live" : "test";
  const ok = db !== "error";
  return json({ ok, service: SERVICE, version: VERSION, stripe_mode: mode, db }, ok ? 200 : 503);
}

const MAX_BODY = 64 * 1024;
async function body(req: Request): Promise<Record<string, unknown>> {
  const t = await req.text();
  if (t.length > MAX_BODY) throw new HttpError(413, "body_too_large");
  if (!t) return {};
  try { const j = JSON.parse(t); return j && typeof j === "object" ? j : {}; } catch { throw new HttpError(400, "invalid_json"); }
}
function cors(res: Response, env: Env): Response {
  const o = env.TITANOS_SITE_ORIGIN;
  if (o) { res.headers.set("access-control-allow-origin", o); res.headers.set("access-control-allow-headers", "authorization, content-type"); res.headers.set("access-control-allow-methods", "GET, POST, DELETE, OPTIONS"); res.headers.set("vary", "origin"); }
  return res;
}

// handle(req, env, deps): deps is the injected store/billing/dns/mailer. With no deps every route except /health
// fails closed with 503 (the D1 store is not built yet), so a half-wired deploy can never pretend to bill anyone.
export async function handle(req: Request, env: Env, deps?: Deps): Promise<Response> {
  const { pathname } = new URL(req.url);
  if (pathname === "/health") {
    if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);
    return health(env);
  }
  if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }), env);
  if (!deps) return json({ error: "store_unavailable" }, 503);
  try {
    return cors(await route(req, pathname, deps), env);
  } catch (e) {
    if (e instanceof HttpError) return cors(json({ error: e.code }, e.status), env);
    throw e;
  }
}

async function route(req: Request, path: string, d: Deps): Promise<Response> {
  const m = req.method;
  const seg = path.split("/").filter(Boolean);
  if (path === "/catalogue" && m === "GET") return json({ products: Object.values(PRODUCTS).map(({ id, name, amountCents, mode, interval, minMonths, needsVerifiedDomain }) => ({ id, name, amountCents, currency: "aud", mode, interval, minMonths, needsVerifiedDomain })) });
  if (path === "/auth/request" && m === "POST") { await svc.requestLogin(d, (await body(req)).email); return json({ ok: true }, 202); } // same answer for known and unknown emails
  if (path === "/auth/verify" && m === "POST") return json(await svc.verifyLogin(d, (await body(req)).token));
  if (path === "/stripe/webhook" && m === "POST") {
    const raw = await req.text();
    if (raw.length > 1_000_000) throw new HttpError(413, "body_too_large");
    if (!(await verifyStripeSignature(raw, req.headers.get("stripe-signature"), d.webhookSecret, Math.floor(d.now() / 1000)))) throw new HttpError(400, "bad_signature");
    let ev; try { ev = JSON.parse(raw); } catch { throw new HttpError(400, "invalid_json"); }
    return json({ result: await svc.handleStripeEvent(d, ev) });
  }
  const er = await entRoute(req, path, d);
  if (er) return er;
  const a = await svc.authenticate(d, req.headers.get("authorization"));
  if (path === "/me" && m === "GET") return json({ id: a.id, email: a.email, seat: a.seat });
  if (path === "/domains" && m === "POST") return json(await svc.addDomain(d, a, (await body(req)).domain), 201);
  if (path === "/domains" && m === "GET") return json({ domains: (await d.store.domainsFor(a.id)).map((x) => ({ id: x.id, domain: x.domain, verified: !!x.verifiedAt })) });
  if (seg[0] === "domains" && seg[2] === "verify" && m === "POST") return json(await svc.verifyDomain(d, a, seg[1]));
  if (path === "/checkout" && m === "POST") { const b = await body(req); return json(await svc.startCheckout(d, a, b.product, b.domain), 201); }
  if (path === "/billing" && m === "GET") return json({ purchases: await d.store.purchasesFor(a.id), subscriptions: await d.store.subscriptionsFor(a.id), portalUrl: a.stripeCustomerId ? await d.billing.portalUrl(a.stripeCustomerId, d.siteOrigin + "/app/billing") : null });
  if (path === "/invoices" && m === "GET") return json({ invoices: await svc.listInvoices(d, a) });
  if (seg[0] === "invoices" && seg.length === 2 && m === "GET") return new Response(await svc.renderInvoice(d, a, seg[1]), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  if (seg[0] === "subscriptions" && seg[2] === "cancel" && m === "POST") return json(await svc.cancelSubscription(d, a, seg[1]));
  if (path === "/refunds" && m === "POST") return json(await svc.requestRefund(d, a, String((await body(req)).purchaseId ?? "")));
  if (path === "/keys" && m === "POST") return json(await svc.createKey(d, a, (await body(req)).scopes), 201);
  if (path === "/keys" && m === "GET") return json({ keys: await svc.listKeys(d, a) });
  if (seg[0] === "keys" && seg.length === 2 && m === "DELETE") { await svc.revokeKey(d, a, seg[1]); return json({ ok: true }); }
  if (path === "/account/export" && m === "GET") return json(await svc.exportData(d, a));
  if (path === "/account" && m === "DELETE") return json(await svc.deleteAccount(d, a, (await body(req)).confirm));
  return json({ error: "not_found", path }, 404);
}

// Cron entry. With an env.payouts adapter set it runs ONE payout tick; without one it is a labelled no-op (never a crash, never a 503).
// Nothing triggers this yet: no [triggers] crons in wrangler.toml (deploy is GATE5). ctx.waitUntil keeps the Worker alive for the tick.
export type ScheduledOutcome = { ran: false; label: "payout_tick_noop_no_adapter" } | ({ ran: true; label: "payout_tick" } & TickResult);
export async function scheduledTick(env: Env, now: number = Date.now()): Promise<ScheduledOutcome> {
  const p = env.payouts;
  if (!p) return { ran: false, label: "payout_tick_noop_no_adapter" };
  const r = await runPayoutTick(p.store, p.transfer, now, { lookup: p.lookup, maxRows: p.maxRows, log: (l) => console.log(l) });
  return { ran: true, label: "payout_tick", ...r };
}

export default {
  scheduled(event: { scheduledTime?: number }, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): void {
    const now = typeof event?.scheduledTime === "number" ? event.scheduledTime : Date.now();
    ctx.waitUntil(scheduledTick(env, now).then((o) => console.log(`scheduled ${o.label}`)).catch(() => console.log("scheduled payout_tick_failed")));
  },
  fetch(req: Request, env: Env): Promise<Response> {
    return handle(req, env).catch(() => json({ error: "internal" }, 500));
  },
};
