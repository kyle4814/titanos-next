import type { Env } from "./env.ts";
import * as svc from "./service.ts";
import { HttpError, type Deps } from "./service.ts";
import { verifyStripeSignature } from "./stripe.ts";
import { PRODUCTS } from "./catalogue.ts";
import * as own from "./owner/service.ts";
import * as mkt from "./market/service.ts";
import { authenticateKey, handleMcp } from "./agent/mcp.ts";
import { startTopup, handleCreditEvent, CREDIT_PACKS } from "./agent/credits.ts";
import { TOOLS, publicTool } from "./agent/tools.ts";
import { verifyReceipt } from "./agent/receipt.ts";
import { agentCard } from "./agent/files.ts";
import { entRoute } from "./enterprise/routes.ts";
import { workerScheduled } from "./owner/cron.ts";
import { buildDeps } from "./d1/deps.ts";

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
const apiOrigin = (req: Request) => new URL(req.url).origin;
async function limited(req: Request): Promise<string> { const t = await req.text(); if (t.length > MAX_BODY) throw new HttpError(413, "body_too_large"); return t; }
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
  if (path === "/agent/tools" && m === "GET") return json({ tools: TOOLS.map(publicTool), creditPacks: Object.values(CREDIT_PACKS), creditRate: "1 credit = AU$0.01 (example rate)" });
  if (path === "/.well-known/agent.json" && m === "GET") return json(agentCard(d.siteOrigin, apiOrigin(req)));
  if (path === "/agent/receipts/verify" && m === "POST") { // stateless: anyone holding a receipt can check it; nothing is looked up or revealed
    const r = (await body(req)).receipt as any;
    const shape = r && typeof r === "object" && ["id", "tool", "keyId", "accountId", "inputSha", "outputSha", "mode", "sig"].every((k) => typeof r[k] === "string") && typeof r.at === "number" && typeof r.credits === "number";
    return json({ valid: shape ? await verifyReceipt(d.receiptSecret ?? "", r) : false });
  }
  if (path === "/mcp") {
    if (m === "GET") return json({ error: "use_post", hint: "MCP over HTTP: POST JSON-RPC 2.0 with Authorization: Bearer tk_..." }, 405);
    if (m !== "POST") return json({ error: "method_not_allowed" }, 405);
    const auth = await authenticateKey(d, req.headers.get("authorization"));
    if (!auth) { const res = json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "unauthenticated" } }, 401); res.headers.set("www-authenticate", 'Bearer realm="titanos-mcp"'); return res; }
    let msg; try { msg = JSON.parse(await limited(req)); } catch (e) { if (e instanceof HttpError) throw e; return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse_error" } }, 400); }
    let out;
    try { out = await handleMcp(d, auth, msg, { idem: req.headers.get("idempotency-key"), byok: req.headers.get("x-model-key") }); }
    catch (e) {
      // F39: a validation failure on the MCP route keeps its HTTP status but carries a JSON-RPC 2.0 error object, so a strict MCP client can parse it. REST routes are unchanged.
      if (!(e instanceof HttpError)) throw e;
      const rid = msg && !Array.isArray(msg) && (typeof msg.id === "string" || typeof msg.id === "number") ? msg.id : null;
      return json({ jsonrpc: "2.0", id: rid, error: { code: e.status === 422 ? -32602 : -32600, message: e.code, data: { error: e.code } } }, e.status);
    }
    return out === null ? new Response(null, { status: 202 }) : json(out);
  }
  if (path === "/auth/request" && m === "POST") { await svc.requestLogin(d, (await body(req)).email); return json({ ok: true }, 202); } // same answer for known and unknown emails
  if (path === "/auth/verify" && m === "POST") return json(await svc.verifyLogin(d, (await body(req)).token));
  if (path === "/stripe/webhook" && m === "POST") {
    const raw = await req.text();
    if (raw.length > 1_000_000) throw new HttpError(413, "body_too_large");
    if (!(await verifyStripeSignature(raw, req.headers.get("stripe-signature"), d.webhookSecret, Math.floor(d.now() / 1000)))) throw new HttpError(400, "bad_signature");
    let ev; try { ev = JSON.parse(raw); } catch { throw new HttpError(400, "invalid_json"); }
    const isCheckoutDone = ev?.type === "checkout.session.completed" || ev?.type === "checkout.session.async_payment_succeeded";
    const mj = isCheckoutDone ? ev?.data?.object?.metadata?.market_job_id : undefined;
    if (typeof mj === "string") {   // a marketplace job funding, not a C2 purchase
      const o = ev.data.object;
      // R-C4: money must exist before a job opens. An unpaid session (delayed method) is ignored WITHOUT claiming the event id,
      // so the later async_payment_succeeded (a different event id) funds it with the same amount and checkout checks.
      if (o.payment_status !== "paid") return json({ result: "ignored" });
      if (!(await d.store.claimEvent(String(ev.id)))) return json({ result: "duplicate" });
      return json({ result: await mkt.confirmFunded(d, { jobId: mj, checkoutId: String(o.id), paymentIntent: o.payment_intent ? String(o.payment_intent) : undefined, amountTotal: typeof o.amount_total === "number" ? o.amount_total : undefined }) });
    }
    const credit = await handleCreditEvent(d, ev);
    return json({ result: credit ?? (await svc.handleStripeEvent(d, ev)) });
  }
  if (path === "/market/leaderboard" && m === "GET") return json(await mkt.leaderboard(d));   // public, pseudonymous, proven fixes only
  if (seg[0] === "internal" && seg[1] === "market") {   // Kyle's tap and the cron: guarded by the internal secret, never a session
    if (!mkt.isInternal(d, req.headers.get("x-internal-secret"))) throw new HttpError(401, "unauthenticated");
    if (seg[2] === "cards" && seg.length === 3 && m === "GET") return json({ cards: await d.market!.store.openCards() });
    if (seg[2] === "cards" && seg[4] === "resolve" && m === "POST") return json(await mkt.resolveCard(d, seg[3], String((await body(req)).outcome ?? "")));
    if (seg[2] === "sweep" && m === "POST") return json({ sweep: await mkt.sweep(d), warranty: await mkt.warrantySweep(d) });
    return json({ error: "not_found", path }, 404);
  }
  const er = await entRoute(req, path, d);
  if (er) return er;
  const a = await svc.authenticate(d, req.headers.get("authorization"));
  if (seg[0] === "market" || seg[0] === "pro") {
    if (path === "/market/jobs" && m === "POST") return json(await mkt.createJob(d, a, await body(req)), 201);
    if (path === "/market/jobs" && m === "GET") return json(await mkt.myJobs(d, a));
    if (seg[0] === "market" && seg[1] === "jobs" && seg[3] === "cancel" && m === "POST") return json(await mkt.cancelJob(d, a, seg[2]));
    if (seg[0] === "market" && seg[1] === "jobs" && seg[3] === "dispute" && m === "POST") return json(await mkt.dispute(d, a, seg[2], (await body(req)).reason));
    if (seg[0] === "market" && seg[1] === "jobs" && seg[3] === "rescan" && m === "POST") return json(await mkt.rescan(d, a, seg[2]));
    if (path === "/pro/join" && m === "POST") return json(await mkt.joinPro(d, a, await body(req)), 201);
    if (path === "/pro/onboarding" && m === "POST") return json(await mkt.onboard(d, a));
    if (path === "/pro/onboarding/refresh" && m === "POST") return json(await mkt.refreshOnboarding(d, a));
    if (path === "/pro/board" && m === "GET") return json(await mkt.board(d, a));
    if (path === "/pro/rank" && m === "GET") return json(await mkt.myRank(d, a));
    if (path === "/pro/payouts" && m === "GET") return json(await mkt.payouts(d, a));
    if (seg[0] === "pro" && seg[1] === "jobs" && seg[3] === "claim" && m === "POST") return json(await mkt.claim(d, a, seg[2]));
    if (seg[0] === "pro" && seg[1] === "jobs" && seg[3] === "deliver" && m === "POST") return json(await mkt.deliver(d, a, seg[2], (await body(req)).note));
    return json({ error: "not_found", path }, 404);
  }
  if (path === "/me" && m === "GET") return json({ id: a.id, email: a.email, seat: a.seat });
  if (path === "/domains" && m === "POST") return json(await svc.addDomain(d, a, (await body(req)).domain), 201);
  if (path === "/domains" && m === "GET") return json({ domains: (await d.store.domainsFor(a.id)).map((x) => ({ id: x.id, domain: x.domain, verified: !!x.verifiedAt })) });
  if (seg[0] === "domains" && seg[2] === "verify" && m === "POST") return json(await svc.verifyDomain(d, a, seg[1]));
  if (seg[0] === "app" && seg[1] === "domains") {
    if (seg.length === 2 && m === "GET") return json(await own.listDomains(d, a));
    const id = seg[2];
    if (seg.length === 3 && m === "GET") return json(await own.getOverview(d, a, id));
    if (seg[3] === "scan" && m === "POST") return json(await own.scan(d, a, id));
    if (seg[3] === "fix" && m === "POST") return json(await own.fix(d, a, id, (await body(req)).check));
    if (seg[3] === "fixes" && seg[5] === "undo" && m === "POST") return json(await own.undo(d, a, id, seg[4]));
    if (seg[3] === "report" && m === "GET") { const r = await own.getReport(d, a, id); return new URL(req.url).searchParams.get("format") === "md" ? new Response(r.markdown, { headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" } }) : json(r.json); }
  }
  if (path === "/checkout" && m === "POST") { const b = await body(req); return json(await svc.startCheckout(d, a, b.product, b.domain), 201); }
  if (path === "/billing" && m === "GET") return json({ purchases: await d.store.purchasesFor(a.id), subscriptions: await d.store.subscriptionsFor(a.id), portalUrl: a.stripeCustomerId ? await d.billing.portalUrl(a.stripeCustomerId, d.siteOrigin + "/app/billing") : null });
  if (path === "/invoices" && m === "GET") return json({ invoices: await svc.listInvoices(d, a) });
  if (seg[0] === "invoices" && seg.length === 2 && m === "GET") return new Response(await svc.renderInvoice(d, a, seg[1]), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  if (seg[0] === "subscriptions" && seg[2] === "cancel" && m === "POST") return json(await svc.cancelSubscription(d, a, seg[1]));
  if (path === "/refunds" && m === "POST") return json(await svc.requestRefund(d, a, String((await body(req)).purchaseId ?? "")));
  if (path === "/keys" && m === "POST") return json(await svc.createKey(d, a, (await body(req)).scopes), 201);
  if (path === "/keys" && m === "GET") return json({ keys: await svc.listKeys(d, a) });
  if (seg[0] === "keys" && seg.length === 2 && m === "DELETE") { await svc.revokeKey(d, a, seg[1]); return json({ ok: true }); }
  if (path === "/agent/credits" && m === "GET") return json({ balance: await d.store.creditBalance(a.id), entries: (await d.store.creditEntries(a.id)).slice(-50) });
  if (path === "/agent/credits/topup" && m === "POST") return json(await startTopup(d, a, (await body(req)).pack), 201);
  if (path === "/account/export" && m === "GET") return json(await svc.exportData(d, a));
  if (path === "/account" && m === "DELETE") return json(await svc.deleteAccount(d, a, (await body(req)).confirm));
  return json({ error: "not_found", path }, 404);
}

export default {
  fetch(req: Request, env: Env): Promise<Response> {
    return handle(req, env, buildDeps(env)).catch(() => json({ error: "internal" }, 500));
  },
  async scheduled(event: { scheduledTime?: number; cron?: string }, env: Env): Promise<void> {
    await workerScheduled(event, env, buildDeps(env));
  },
};
