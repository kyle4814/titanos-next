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
import { verifyWithRing, ringOf } from "./agent/receipt.ts";
import { traceKeyPrefix, isOperator } from "./agent/keytrace.ts";
import { agentCard } from "./agent/files.ts";
import { json, text, empty } from "./http.ts";
import { entRoute } from "./enterprise/routes.ts";
import { workerScheduled } from "./owner/cron.ts";
import { drainTickScheduled, isDrainTick, type DrainTickOpts } from "./shop/drain_tick_worker.ts";
import { Throttle, ThrottledError, throttleKey } from "./throttle.ts";
import { buildDeps as defaultBuildDeps, BuildDepsError, throttleFor, THROTTLE_LIMITS as LIMITS } from "./build_deps.ts";
import { runPayoutTick, type TickResult } from "./enterprise/payout_tick.ts";

export const SERVICE = "titanos-portal-api";
export const VERSION = "0.1.0";

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
// Throttle wrapper: no d.throttle means no throttling (opt-in for harness callers; the Worker entry ALWAYS injects one).
// Key = scope + hash(account, ip). The IP comes from CF-Connecting-IP ONLY (Cloudflare sets it and strips a client-sent copy;
// X-Forwarded-For is client-controlled, so it is never read). A missing header shares one fixed "noip" bucket, so omitting the
// header cannot buy a fresh budget. FAIL CLOSED: any fault in the throttle itself (key, reserve) is a 503, never an allow-through.
const clientIp = (req: Request) => { const v = req.headers.get("cf-connecting-ip")?.trim(); return v ? v.slice(0, 64) : "noip"; };
async function throttled<T>(d: Deps, req: Request, scope: string, who: string, fn: () => Promise<T>): Promise<T> {
  const th = d.throttle;
  if (!th) return fn();
  let key: string;
  try {
    key = await throttleKey(scope, who, clientIp(req));
    const r = await th.reserveAsync(key);
    if (!r.allowed) { th.note(`throttle block key=${key} retry_after=${r.retryAfterSec}`); throw new ThrottledError(r.retryAfterSec); }
  } catch (e) {
    if (e instanceof ThrottledError) throw e;
    throw new HttpError(503, "throttle_unavailable");
  }
  let out: T;
  try { out = await fn(); } catch (e) { th.note(`throttle fail key=${key}`); throw e; }   // keeps the reserved failure (counts toward the lockout)
  try { await th.reset(key); } catch { /* reset failure only leaves the failure counted: safe direction */ }
  return out;
}
// Extra allowed origins (TITANOS_EXTRA_ORIGINS, comma list, exact match, https only). The request Origin is consulted ONLY to pick an
// entry from this operator-set allowlist; it is never echoed otherwise, so with no list (or no match) the header is the configured
// TITANOS_SITE_ORIGIN exactly as before.
const extraOrigins = (env: Env): string[] => (env.TITANOS_EXTRA_ORIGINS ?? "").split(",").map((x) => x.trim()).filter((x) => /^https:\/\/[a-z0-9.-]+(:\d+)?$/.test(x));
// /auth/request abuse guard: per client IP, then a global hourly cap, on the SAME throttle store as the rest (Memory or D1; new keys only).
// Counted on every request (never reset on success) because each one can cost a real email. IP first, so one noisy IP is refused before it
// can spend the global budget. Answer is the standard 429 too_many_attempts + Retry-After: no address, IP or counter is revealed.
// FAIL CLOSED: a fault in the throttle itself is a 503. No throttle injected (harness callers) = no guard, as for every other throttled route.
const HOUR = 3_600_000;
async function loginAbuseGuard(d: Deps, req: Request): Promise<void> {
  const th = d.throttle; if (!th) return;
  const lim = d.loginLimits ?? { perIpPerHour: 10, globalPerHour: 200 };
  const mk = (n: number) => new Throttle({ maxFailures: n, windowMs: HOUR, lockoutMs: HOUR, now: d.now }, th.store);
  try {
    for (const [key, t] of [[await throttleKey("login_ip", clientIp(req)), mk(lim.perIpPerHour)], ["login_global:all", mk(lim.globalPerHour)]] as const) {
      const r = await t.reserveAsync(key);
      if (!r.allowed) { th.note(`throttle block key=${key} retry_after=${r.retryAfterSec}`); throw new ThrottledError(r.retryAfterSec); }
    }
  } catch (e) {
    if (e instanceof ThrottledError) throw e;
    throw new HttpError(503, "throttle_unavailable");
  }
}
function cors(res: Response, env: Env, req?: Request): Response {
  let o = env.TITANOS_SITE_ORIGIN?.trim();
  const asked = req?.headers.get("origin")?.trim();
  if (o && o !== "*" && o !== "null" && asked && asked !== o && extraOrigins(env).includes(asked)) o = asked;
  // F363: a wildcard or "null" origin is a misconfiguration, never echoed (fail closed: no CORS header). The request Origin is never read.
  if (o && o !== "*" && o !== "null") {
    res.headers.set("access-control-allow-origin", o); res.headers.set("access-control-allow-headers", "authorization, content-type"); res.headers.set("access-control-allow-methods", "GET, POST, PATCH, DELETE, OPTIONS");
    const v = res.headers.get("vary");   // append, never overwrite (an invoice already says vary: accept)
    if (!v || !/(^|,)\s*(origin|\*)\s*(,|$)/i.test(v)) res.headers.set("vary", v ? `${v}, origin` : "origin");
  }
  return res;
}

// handle(req, env, deps): deps is the injected store/billing/dns/mailer. With no deps every route except /health
// fails closed with 503 (the D1 store is not built yet), so a half-wired deploy can never pretend to bill anyone.
export async function handle(req: Request, env: Env, deps?: Deps): Promise<Response> {
  return cors(await handleInner(req, env, deps), env, req);   // F363: ONE exit, so no path (health, no-deps 503, error paths) can skip CORS
}
async function handleInner(req: Request, env: Env, deps?: Deps): Promise<Response> {
  const { pathname } = new URL(req.url);
  if (pathname === "/health") {
    if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);
    return health(env);
  }
  if (req.method === "OPTIONS") return empty(204);
  if (!deps) return json({ error: "store_unavailable" }, 503);
  try {
    return await route(req, pathname, deps);
  } catch (e) {
    if (e instanceof ThrottledError) { const r = json({ error: e.code }, 429); r.headers.set("retry-after", String(e.retryAfterSec)); return r; }
    if (e instanceof HttpError) return json({ error: e.code }, e.status);
    if (e instanceof svc.RefundInFlight) return json({ error: "refund_in_flight" }, 503);
    if (e instanceof svc.RefundRecordPending) return json({ error: "refund_record_pending", refundId: e.refundId, purchaseId: e.purchaseId }, 503);
    throw e;   // unexpected: handle() rejects (pinned by http_headers.test.ts); the Worker entry turns it into a CORS-carrying generic 500
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
    return json({ valid: shape ? await verifyWithRing(ringOf(d), r) : false });
  }
  if (path === "/mcp") {
    if (m === "GET") return json({ error: "use_post", hint: "MCP over HTTP: POST JSON-RPC 2.0 with Authorization: Bearer tk_..." }, 405);
    if (m !== "POST") return json({ error: "method_not_allowed" }, 405);
    const auth = await authenticateKey(d, req.headers.get("authorization"));
    if (!auth) { const res = json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "unauthenticated" } }, 401); res.headers.set("www-authenticate", 'Bearer realm="titanos-mcp"'); return res; }
    // F43: every pre-parse rejection on /mcp (wrong content-type 415, oversize 413, unparseable 400) is a JSON-RPC 2.0 error with id null and the same HTTP status. REST routes keep plain {error}.
    const rpcFail = (status: number, code: number, message: string) => json({ jsonrpc: "2.0", id: null, error: { code, message, data: { status, error: message } } }, status);
    const ct = req.headers.get("content-type");
    if (ct !== null && !/^application\/(?:[\w.+-]+\+)?json\s*(?:;|$)/i.test(ct.trim())) return rpcFail(415, -32600, "unsupported_media_type");
    let msg;
    try { msg = JSON.parse(await limited(req)); }
    catch (e) { if (e instanceof HttpError) return rpcFail(e.status, -32600, e.code); return rpcFail(400, -32700, "parse_error"); }
    let out;
    try { out = await handleMcp(d, auth, msg, { idem: req.headers.get("idempotency-key"), byok: req.headers.get("x-model-key") }); }
    catch (e) {
      // F39: a validation failure on the MCP route keeps its HTTP status but carries a JSON-RPC 2.0 error object, so a strict MCP client can parse it. REST routes are unchanged.
      if (!(e instanceof HttpError)) throw e;
      const rid = msg && !Array.isArray(msg) && (typeof msg.id === "string" || typeof msg.id === "number") ? msg.id : null;
      return json({ jsonrpc: "2.0", id: rid, error: { code: e.status === 422 ? -32602 : -32600, message: e.code, data: { status: e.status, error: e.code } } }, e.status);
    }
    return out === null ? empty(202) : json(out);
  }
  if (path === "/auth/request" && m === "POST") { await loginAbuseGuard(d, req); await svc.requestLogin(d, (await body(req)).email); return json({ ok: true }, 202); } // same answer for known and unknown emails
  if (path === "/auth/verify" && m === "POST") { const tok = (await body(req)).token; return json(await throttled(d, req, "login", "", () => svc.verifyLogin(d, tok))); }
  if (path === "/auth/logout" && m === "POST") {
    await svc.logout(d, req.headers.get("authorization"));
    // The session is a bearer token held by the browser (no cookie is ever set by this API); the Set-Cookie below is a belt-and-braces clear
    // of any legacy "ss" cookie and is harmless when none exists.
    const res = json({ ok: true });
    res.headers.append("set-cookie", "ss=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax");
    return res;
  }
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
  if (seg[0] === "internal" && seg[1] === "keys" && seg[2] === "trace" && seg.length === 3 && m === "GET") { // operator abuse tracing: key prefix -> account -> recent calls
    if (!isOperator(d, req.headers.get("x-operator-secret"))) throw new HttpError(401, "unauthenticated");
    const u = new URL(req.url);
    return json(await traceKeyPrefix(d, u.searchParams.get("prefix") ?? "", { accountId: u.searchParams.get("account") ?? undefined }));
  }
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
    if (seg[0] === "market" && seg[1] === "jobs" && seg[3] === "dispute" && seg.length === 4 && m === "POST") return json(await mkt.dispute(d, a, seg[2], (await body(req)).reason));
    if (seg[0] === "market" && seg[1] === "jobs" && seg[3] === "dispute" && seg[4] === "evidence" && m === "POST") return json(await mkt.disputeEvidence(d, a, seg[2], await body(req)));
    if (seg[0] === "market" && seg[1] === "jobs" && seg[3] === "dispute" && seg[4] === "audit" && m === "GET") return json(await mkt.disputeAudit(d, a, seg[2]));
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
  if (seg[0] === "domains" && seg[2] === "verify" && m === "POST") return json(await throttled(d, req, "dnsverify", a.id, () => svc.verifyDomain(d, a, seg[1])));
  if (seg[0] === "app" && seg[1] === "domains") {
    if (seg.length === 2 && m === "GET") return json(await own.listDomains(d, a));
    const id = seg[2];
    if (seg.length === 3 && m === "GET") return json(await own.getOverview(d, a, id));
    if (seg[3] === "scan" && m === "POST") return json(await own.scan(d, a, id));
    if (seg[3] === "fix" && m === "POST") return json(await own.fix(d, a, id, (await body(req)).check));
    if (seg[3] === "fixes" && seg[5] === "undo" && m === "POST") return json(await own.undo(d, a, id, seg[4]));
    if (seg[3] === "report" && m === "GET") { const r = await own.getReport(d, a, id); return new URL(req.url).searchParams.get("format") === "md" ? text(r.markdown, "text/markdown; charset=utf-8") : json(r.json); }
  }
  if (path === "/checkout" && m === "POST") { const b = await body(req); return json(await throttled(d, req, "checkout", a.id, () => svc.startCheckout(d, a, b.product, b.domain)), 201); }
  if (path === "/billing" && m === "GET") return json({ purchases: await d.store.purchasesFor(a.id), subscriptions: await d.store.subscriptionsFor(a.id), portalUrl: a.stripeCustomerId ? await d.billing.portalUrl(a.stripeCustomerId, d.siteOrigin + "/app/billing") : null });
  if (path === "/invoices" && m === "GET") return json({ invoices: await svc.listInvoices(d, a) });
  if (seg[0] === "invoices" && (seg.length === 2 || (seg.length === 3 && seg[2] === "credit-note")) && m === "GET") {
    const doc = seg.length === 3 ? await svc.renderCreditNote(d, a, seg[1]) : await svc.renderInvoice(d, a, seg[1]);
    const html = /\btext\/html\b/i.test(req.headers.get("accept") ?? ""); // default is the text twin
    return text(html ? doc.html : doc.text, html ? "text/html; charset=utf-8" : "text/plain; charset=utf-8", { vary: "accept" }); // f86 shared headers
  }
  if (seg[0] === "subscriptions" && seg[2] === "cancel" && m === "POST") return json(await svc.cancelSubscription(d, a, seg[1]));
  if (path === "/refunds" && m === "POST") return json(await svc.requestRefund(d, a, String((await body(req)).purchaseId ?? "")));
  if (path === "/keys" && m === "POST") { const b = await body(req); return json(await svc.createKey(d, a, b.scopes, { capDaily: b.capDaily, capTotal: b.capTotal }), 201); }
  if (path === "/keys" && m === "GET") return json({ keys: await svc.listKeys(d, a) });
  if (seg[0] === "keys" && seg.length === 2 && m === "PATCH") { const b = await body(req); return json(await svc.setKeyCaps(d, a, seg[1], { capDaily: b.capDaily, capTotal: b.capTotal })); }
  if (seg[0] === "keys" && seg.length === 2 && m === "DELETE") { await svc.revokeKey(d, a, seg[1]); return json({ ok: true }); }
  if (path === "/agent/credits" && m === "GET") return json({ balance: await d.store.creditBalance(a.id), entries: (await d.store.creditEntries(a.id)).slice(-50) });
  if (path === "/agent/credits/topup" && m === "POST") return json(await startTopup(d, a, (await body(req)).pack), 201);
  if (path === "/account/export" && m === "GET") return json(await svc.exportData(d, a));
  if (path === "/account" && m === "DELETE") return json(await svc.deleteAccount(d, a, (await body(req)).confirm));
  return json({ error: "not_found", path }, 404);
}

// Worker entry factory: ONE Throttle (Memory adapter, injectable clock) is built per Worker and injected into Deps for every
// request, so login verify, DNS-TXT verify and checkout start are always guarded. Memory state is per isolate: a shared
// adapter (Durable Object / D1) behind ThrottleStore is the WOULD-FLIP. buildDeps is undefined until the D1 store lands
// (every route except /health then fails closed with 503).
export interface WorkerOpts { buildDeps?: (env: Env) => Deps | undefined; throttle?: Throttle; makeThrottle?: (env: Env) => Throttle | undefined; now?: () => number; log?: (line: string) => void; drainTick?: DrainTickOpts }
export const THROTTLE_LIMITS = LIMITS;
export function createWorker(opts: WorkerOpts = {}) {
  // f216: with no explicit buildDeps the default is the real one (D1Store over env.DB, shared D1 throttle); no DB binding still 503s.
  const build = opts.buildDeps ?? ((env: Env) => defaultBuildDeps(env));
  const makeThrottle = opts.makeThrottle ?? (opts.buildDeps || opts.throttle ? undefined : (env: Env) => throttleFor(env, opts.now, opts.log));
  const fixed = opts.throttle ?? (makeThrottle ? undefined : new Throttle({ ...THROTTLE_LIMITS, now: opts.now ?? (() => Date.now()), log: opts.log }));
  return {
    fetch(req: Request, env: Env): Promise<Response> {
      return Promise.resolve().then(() => {
        let base: Deps | undefined;
        try { base = build(env); } catch (e) {
          if (!(e instanceof BuildDepsError)) throw e;
          opts.log?.(`buildDeps refused: ${e.message}`);   // reason + binding NAME only, never a value
          const p = new URL(req.url).pathname;
          if (p === "/health" || req.method === "OPTIONS") return handle(req, env, undefined);
          return cors(json({ error: "deps_unavailable", reason: e.message }, 503), env, req);
        }
        const throttle = fixed ?? makeThrottle?.(env);
        return handle(req, env, base && throttle ? { ...base, throttle } : undefined);
      }).catch(() => cors(json({ error: "internal" }, 500), env, req));
    },
    // f334: the shop drain tick owns ONLY its own cron expression. Any other cron runs the owner cron and then the C8 payout tick.
    // C8 f57: with a ctx, the work is handed to ctx.waitUntil (the Worker stays alive for the tick); without one it is awaited (tests, drain).
    scheduled(event: { scheduledTime?: number; cron?: string }, env: Env, ctx?: { waitUntil(p: Promise<unknown>): void }): Promise<void> {
      const run = async (): Promise<void> => {
        if (isDrainTick(event)) { await drainTickScheduled(event, env, { now: opts.now, ...opts.drainTick }); return; }
        await workerScheduled(event, env);
        const now = typeof event?.scheduledTime === "number" ? event.scheduledTime : (opts.now ?? (() => Date.now()))();
        const o = await scheduledTick(env, now);
        console.log(`scheduled ${o.label}`);
      };
      if (ctx?.waitUntil) { ctx.waitUntil(run().catch(() => console.log("scheduled failed"))); return Promise.resolve(); }
      return run();
    },
  };
}
// The shipped default: real deps from the Env's D1 binding, shared D1 throttle. With no store adapter wired it refuses (503, named reason).
export default createWorker({ buildDeps: (env) => defaultBuildDeps(env), makeThrottle: (env) => throttleFor(env) });
// Cron entry. With an env.payouts adapter set it runs ONE payout tick; without one it is a labelled no-op (never a crash, never a 503).
// Nothing triggers this yet: no [triggers] crons in wrangler.toml (deploy is GATE5). ctx.waitUntil keeps the Worker alive for the tick.
export type ScheduledOutcome = { ran: false; label: "payout_tick_noop_no_adapter" } | ({ ran: true; label: "payout_tick" } & TickResult);
export async function scheduledTick(env: Env, now: number = Date.now()): Promise<ScheduledOutcome> {
  const p = env.payouts;
  if (!p) return { ran: false, label: "payout_tick_noop_no_adapter" };
  const r = await runPayoutTick(p.store, p.transfer, now, { lookup: p.lookup, maxRows: p.maxRows, log: (l) => console.log(l) });
  return { ran: true, label: "payout_tick", ...r };
}
