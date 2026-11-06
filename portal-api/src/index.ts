import type { Env } from "./env.ts";

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

export async function handle(req: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(req.url);
  if (pathname === "/health") {
    if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);
    return health(env);
  }
  return json({ error: "not_found", path: pathname }, 404);
}

export default {
  fetch(req: Request, env: Env): Promise<Response> {
    return handle(req, env).catch(() => json({ error: "internal" }, 500));
  },
};
