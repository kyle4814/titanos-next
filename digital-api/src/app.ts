// titanos-digital Worker logic (the entry file index.ts only re-exports the default handler: workerd rejects any other non-handler named export). The whole no-human-touch sale path for digital products.
//   POST /digital/checkout   { slug, email? }      -> Stripe Checkout Session (AUD, price from the catalogue) -> { url }
//   POST /digital/webhook    Stripe webhook         -> verify signature, idempotent, order log, mint token, email, revoke on refund/dispute
//   GET  /digital/download?t=<token>                -> verify token + order, stream the zip from the PRIVATE R2 bucket
//   GET  /digital/order?s=<session id>              -> { state: pending | processing | sent | revoked } for the thank-you page
//   GET  /health                                    -> booleans only, never a secret
// Nothing here is deployed: wrangler deploy is Kyle's tap (docs/ops/DIGITAL_PRODUCTS_GO_LIVE_2026-11-28.md).
import { ITEMS, type DigitalItem } from "./catalogue.ts";
import type { Env } from "./env.ts";
import { empty, json } from "./http.ts";
import { mailerFor, type DigitalMailer } from "./mailer.ts";
import { HttpError, handleDownload, handleWebhook, orderStatus, startCheckout, type Deps } from "./service.ts";
import { DigitalStore } from "./store.ts";

export const SERVICE = "titanos-digital";
export interface WorkerOpts { now?: () => number; fetchFn?: typeof fetch; mailer?: DigitalMailer; items?: readonly DigitalItem[]; log?: (l: string) => void }

const MAX_BODY = 16 * 1024;
const clientIp = (req: Request) => req.headers.get("cf-connecting-ip")?.trim().slice(0, 64) || "noip";   // set by Cloudflare; a client-sent X-Forwarded-For is never read

export function cors(res: Response, env: Env, allowedPath: boolean): Response {
  const o = env.SITE_ORIGIN?.trim();
  if (allowedPath && o && o !== "*" && o !== "null") {
    res.headers.set("access-control-allow-origin", o); res.headers.set("access-control-allow-headers", "content-type"); res.headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
    res.headers.set("vary", "origin");
  }
  return res;
}

export function buildDeps(env: Env, opts: WorkerOpts = {}): Deps {
  const now = opts.now ?? (() => Date.now());
  if (!env.DB) throw new HttpError(503, "missing_binding:DB");
  const store = new DigitalStore(env.DB);
  const siteOrigin = env.SITE_ORIGIN?.trim();
  if (!siteOrigin) throw new HttpError(503, "missing_binding:SITE_ORIGIN");
  return {
    store, bucket: env.DIGITAL_BUCKET, mailer: opts.mailer ?? mailerFor(env, store, now, opts.fetchFn), items: opts.items ?? ITEMS,
    mode: env.DIGITAL_STRIPE_MODE === "live" ? "live" : "test",
    stripeKey: env.DIGITAL_STRIPE_SECRET_KEY?.trim() || undefined, webhookSecret: env.DIGITAL_WEBHOOK_SECRET?.trim() || undefined,
    tokenSecret: env.DIGITAL_TOKEN_SECRET && env.DIGITAL_TOKEN_SECRET.length >= 16 ? env.DIGITAL_TOKEN_SECRET : undefined,
    siteOrigin, publicOrigin: env.DIGITAL_PUBLIC_ORIGIN?.trim() || undefined, fetchFn: opts.fetchFn, now, log: opts.log ?? ((l) => console.log(l)),
  };
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const t = await req.text();
  if (t.length > MAX_BODY) throw new HttpError(413, "body_too_large");
  if (!t) return {};
  try { const j = JSON.parse(t); return j && typeof j === "object" && !Array.isArray(j) ? j : {}; } catch { throw new HttpError(400, "invalid_json"); }
}

async function route(req: Request, env: Env, opts: WorkerOpts): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/health" && req.method === "GET") {
    return json({ ok: true, service: SERVICE, stripe_mode: env.DIGITAL_STRIPE_MODE === "live" ? "live" : "test", products: (opts.items ?? ITEMS).length,
      bindings: { db: !!env.DB, bucket: !!env.DIGITAL_BUCKET, stripe_key: !!env.DIGITAL_STRIPE_SECRET_KEY, webhook_secret: !!env.DIGITAL_WEBHOOK_SECRET, token_secret: !!env.DIGITAL_TOKEN_SECRET, mailer: !!(env.RESEND_API_KEY && env.MAIL_FROM) } });
  }
  if (req.method === "OPTIONS") return empty(204);
  const d = buildDeps(env, opts);
  if (path === "/digital/checkout") { if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405); return startCheckout(d, await readBody(req), clientIp(req)); }
  if (path === "/digital/webhook") { if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405); return handleWebhook(d, await req.text(), req.headers.get("stripe-signature"), url.origin); }
  if (path === "/digital/download") { if (req.method !== "GET" && req.method !== "HEAD") return json({ error: "method_not_allowed" }, 405); return handleDownload(d, url.searchParams.get("t"), req.method); }
  if (path === "/digital/order") { if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405); return orderStatus(d, url.searchParams.get("s")); }
  return json({ error: "not_found" }, 404);
}

export function createWorker(opts: WorkerOpts = {}) {
  return {
    async fetch(req: Request, env: Env): Promise<Response> {
      const p = new URL(req.url).pathname;
      const browserPath = p === "/digital/checkout" || p === "/digital/order";   // only the two routes the static site calls from the browser get CORS
      let res: Response;
      try { res = await route(req, env, opts); }
      catch (e) {
        if (e instanceof HttpError) res = json({ error: e.code }, e.status);
        else { (opts.log ?? console.log)(`digital internal error: ${(e as Error)?.message ?? "unknown"}`); res = json({ error: "internal" }, 500); }   // webhook failures land here: 500 makes Stripe retry
      }
      return cors(res, env, browserPath);
    },
  };
}

