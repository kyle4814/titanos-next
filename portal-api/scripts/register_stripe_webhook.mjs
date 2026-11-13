// Registers the portal Worker's Stripe webhook endpoint and stores its signing secret as the Worker secret, in one MACHINE step.
// RUN ONLY AT CUTOVER, after the owner's deploy approval (PRODUCTION_CUTOVER.md step "register webhook"). Never run in tests: the
// test drives run() with a stubbed fetch and a stubbed wrangler runner.
//
//   node scripts/register_stripe_webhook.mjs --hostname portal-api.titanos.tech --confirm-live portal-api.titanos.tech [--key-env NAME] [--dry-run]
//
// Safety: the key is read from the env var NAME (default STRIPE_SECRET_KEY) and never printed; it must be a live key (sk_live_/rk_live_);
// --confirm-live must equal --hostname; existing endpoints are LISTED first and a match on the same URL changes nothing (idempotent);
// the signing secret from the create response goes straight to `npx wrangler secret put STRIPE_WEBHOOK_SECRET` on stdin: never to disk,
// terminal, logs or argv. Stripe error bodies are not echoed (a 401 body can quote part of the key); only status, code and type are.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export const WEBHOOK_PATH = "/stripe/webhook";   // the route src/index.ts serves
// Exactly the event types the handler consumes (src/service.ts handleStripeEvent, src/agent/credits.ts, src/index.ts marketplace funding). Pinned by test.
export const EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "invoice.paid", "customer.subscription.deleted", "charge.refunded"];
export const SECRET_NAME = "STRIPE_WEBHOOK_SECRET";
const API = "https://api.stripe.com/v1/webhook_endpoints";
const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const PORTAL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function parseArgs(argv) {
  const o = { keyEnv: "STRIPE_SECRET_KEY", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === "--hostname") o.hostname = next();
    else if (a === "--confirm-live") o.confirm = next();
    else if (a === "--key-env") o.keyEnv = next();
    else if (a === "--dry-run") o.dryRun = true;
    else throw new Error(`unknown argument ${a}`);
  }
  return o;
}
// Default wrangler runner: the secret travels on stdin only.
export function wranglerPut(secret) {
  return new Promise((res) => {
    const p = spawn("npx", ["wrangler", "secret", "put", SECRET_NAME], { cwd: PORTAL_DIR, stdio: ["pipe", "inherit", "inherit"] });
    p.on("error", () => res(1)); p.on("close", (c) => res(c ?? 1));
    p.stdin.on("error", () => {}); p.stdin.end(secret + "\n");
  });
}
const form = (url) => new URLSearchParams([["url", url], ...EVENTS.map((e) => ["enabled_events[]", e]), ["description", "TITANOS portal API (registered by scripts/register_stripe_webhook.mjs)"]]).toString();
const perm = (s) => `Stripe answered ${s}: the key lacks permission. In the dashboard, give the restricted key "Webhook Endpoints: Write" (read is needed for the list), or use a key that has it, then re-run.`;

// run(argv, deps) -> exit code. deps: { env, fetchFn, putSecret, out, err } (all injectable for tests).
export async function run(argv, deps = {}) {
  const { env = process.env, fetchFn = fetch, putSecret = wranglerPut, out = (l) => console.log(l), err = (l) => console.error(l) } = deps;
  let o; try { o = parseArgs(argv); } catch (e) { err(String(e.message)); return 2; }
  if (!o.hostname || !HOST_RE.test(o.hostname)) { err("--hostname <bare hostname, e.g. portal-api.titanos.tech> is required"); return 2; }
  if (o.confirm !== o.hostname) { err("refused: --confirm-live must be given and equal --hostname"); return 2; }
  if (!/^[A-Z_][A-Z0-9_]*$/.test(o.keyEnv)) { err("--key-env must be an environment variable NAME"); return 2; }
  const url = `https://${o.hostname}${WEBHOOK_PATH}`;
  if (o.dryRun) {
    out(`DRY RUN (nothing is sent). Key is read from $${o.keyEnv}; shown masked.`);
    out(`1. GET  ${API}?limit=100   Authorization: Bearer ****`);
    out(`2. if no endpoint has url ${url}:`);
    out(`   POST ${API}   Authorization: Bearer ****   body: ${form(url)}`);
    out(`3. pipe the returned signing secret (whsec_****) on stdin to: npx wrangler secret put ${SECRET_NAME}`);
    return 0;
  }
  const key = (env[o.keyEnv] ?? "").trim();
  if (!key) { err(`refused: $${o.keyEnv} is not set`); return 2; }
  if (!/^(sk|rk)_live_/.test(key)) { err("refused: the key is not a live key (sk_live_ or rk_live_)"); return 2; }
  const call = (full, init) => fetchFn(full, { ...init, headers: { authorization: `Bearer ${key}`, ...(init?.headers ?? {}) } });
  // 1 LIST (paginated), reuse on a URL match
  let after;
  for (;;) {
    const r = await call(`${API}?limit=100${after ? `&starting_after=${encodeURIComponent(after)}` : ""}`, { method: "GET" });
    if (r.status === 401 || r.status === 403) { err(perm(r.status)); return 3; }
    if (!r.ok) { err(`list failed: Stripe answered ${r.status}`); return 4; }
    const j = await r.json();
    const hit = (j.data ?? []).find((e) => e.url === url);
    if (hit) {
      out(`already registered (id ${hit.id}) for ${url}: nothing changed, nothing created.`);
      out(`Stripe shows a signing secret only at creation; if the Worker secret ${SECRET_NAME} is not set, reveal it in the dashboard for that endpoint and run: npx wrangler secret put ${SECRET_NAME}`);
      const missing = EVENTS.filter((e) => !(hit.enabled_events ?? []).includes(e) && !(hit.enabled_events ?? []).includes("*"));
      if (missing.length) out(`NOTE: that endpoint is missing events: ${missing.join(", ")} (fix in the dashboard)`);
      return 0;
    }
    if (!j.has_more || !(j.data ?? []).length) break;
    after = j.data[j.data.length - 1].id;
  }
  // 2 CREATE
  const c = await call(API, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "idempotency-key": `portal-webhook-${o.hostname}` }, body: form(url) });
  if (c.status === 401 || c.status === 403) { err(perm(c.status)); return 3; }
  if (!c.ok) { let code = ""; try { const b = await c.json(); code = ` (${b?.error?.type ?? ""} ${b?.error?.code ?? ""})`.replace(" )", ")"); } catch { /* no body */ } err(`create failed: Stripe answered ${c.status}${code}`); return 4; }
  const created = await c.json();
  if (typeof created.secret !== "string" || !created.secret.startsWith("whsec_")) { err(`endpoint ${created.id ?? "?"} was created but no signing secret came back; reveal it in the dashboard and run: npx wrangler secret put ${SECRET_NAME}`); return 5; }
  out(`created endpoint ${created.id} for ${url} with ${EVENTS.length} events`);
  // 3 STORE the secret (stdin only)
  const code = await putSecret(created.secret);
  if (code !== 0) { err(`wrangler secret put failed (exit ${code}). The endpoint ${created.id} exists; reveal its signing secret in the dashboard and run: npx wrangler secret put ${SECRET_NAME}`); return 5; }
  out(`${SECRET_NAME} stored as a Worker secret (value not shown).`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2)).then((c) => process.exit(c));
}
