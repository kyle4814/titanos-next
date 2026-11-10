#!/usr/bin/env node
// f402 state-change matrix: discovery + route table for every state-changing (POST/PUT/PATCH/DELETE) route of the portal API.
// Discovery greps the router sources for `m === "POST|PUT|PATCH|DELETE"` lines; every discovered line must be claimed by a table
// entry (`sig` = a substring of that source line). The dynamic assertions live in portal-api/test/state_change_matrix.test.ts.
// Usage: node scripts/state_change_matrix.mjs [--md]   (exit 1 when a discovered route has no table entry)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCES = ["portal-api/src/index.ts", "portal-api/src/enterprise/routes.ts"];
const MUT = /m === "(POST|PUT|PATCH|DELETE)"/;

// kind: session (Authorization: Bearer ss_...) | allow (named exception, `why` required) | secret (x-internal-secret / x-operator-secret) is also allow-listed
// A = account A's own resource ids are not needed: the refusal paths fire before any handler, and the control request only has to get past auth.
const S = (id, method, path, sig, body) => ({ id, kind: "session", method, path, sig, body });
const A = (id, method, path, sig, why, extra = {}) => ({ id, kind: "allow", method, path, sig, why, ...extra });
const PRE = (id, method, path, sig, body) => ({ id, kind: "preauth", method, path, sig, body });
export const ROUTES = [
  // C2 account / billing / keys / domains / owner
  PRE("c2-auth-request", "POST", "/auth/request", 'path === "/auth/request"', { email: "matrix@example.test" }),
  PRE("c2-auth-verify", "POST", "/auth/verify", 'path === "/auth/verify"', { token: "ll_" + "0".repeat(8) }),
  S("c2-auth-logout", "POST", "/auth/logout", 'path === "/auth/logout"'),
  S("c2-domains-add", "POST", "/domains", 'path === "/domains" && m === "POST"', { domain: "matrix-a.example.test" }),
  S("c2-domains-verify", "POST", "/domains/dom_x/verify", 'seg[0] === "domains" && seg[2] === "verify"'),
  S("c2-owner-scan", "POST", "/app/domains/dom_x/scan", 'seg[3] === "scan"'),
  S("c2-owner-fix", "POST", "/app/domains/dom_x/fix", 'seg[3] === "fix"', { check: "SPF" }),
  S("c2-owner-undo", "POST", "/app/domains/dom_x/fixes/fix_x/undo", 'seg[3] === "fixes" && seg[5] === "undo"'),
  S("c2-checkout", "POST", "/checkout", 'path === "/checkout" && m === "POST"', { product: "monitor_monthly", domain: "matrix-a.example.test" }),
  S("c2-sub-cancel", "POST", "/subscriptions/sub_x/cancel", 'seg[0] === "subscriptions" && seg[2] === "cancel"'),
  S("c2-refund", "POST", "/refunds", 'path === "/refunds" && m === "POST"', { purchaseId: "pur_x" }),
  S("c2-keys-create", "POST", "/keys", 'path === "/keys" && m === "POST"', { scopes: ["agent:read"] }),
  S("c2-keys-caps", "PATCH", "/keys/key_x", 'm === "PATCH") { const b = await body(req); return json(await svc.setKeyCaps', { capDaily: 5 }),
  S("c2-keys-revoke", "DELETE", "/keys/key_x", 'm === "DELETE") { await svc.revokeKey'),
  S("c2-credits-topup", "POST", "/agent/credits/topup", 'path === "/agent/credits/topup"', { pack: "starter" }),
  S("c2-account-delete", "DELETE", "/account", 'path === "/account" && m === "DELETE"', { confirm: "DELETE" }),
  // C4 marketplace jobs
  S("c4-job-create", "POST", "/market/jobs", 'path === "/market/jobs" && m === "POST"', { domainId: "dom_x", check: "SPF" }),
  S("c4-job-cancel", "POST", "/market/jobs/job_x/cancel", 'seg[3] === "cancel"'),
  S("c4-job-dispute", "POST", "/market/jobs/job_x/dispute", 'seg[3] === "dispute" && seg.length === 4', { reason: "matrix" }),
  S("c4-job-dispute-evidence", "POST", "/market/jobs/job_x/dispute/evidence", 'seg[4] === "evidence"', { note: "matrix" }),
  S("c4-job-rescan", "POST", "/market/jobs/job_x/rescan", 'seg[3] === "rescan"'),
  S("c4-pro-join", "POST", "/pro/join", 'path === "/pro/join"', { acceptTerms: true }),
  S("c4-pro-onboarding", "POST", "/pro/onboarding", 'path === "/pro/onboarding" && m'),
  S("c4-pro-onboarding-refresh", "POST", "/pro/onboarding/refresh", 'path === "/pro/onboarding/refresh"'),
  S("c4-pro-claim", "POST", "/pro/jobs/job_x/claim", 'seg[3] === "claim"'),
  S("c4-pro-deliver", "POST", "/pro/jobs/job_x/deliver", 'seg[3] === "deliver"', { note: "matrix" }),
  // C8 enterprise / partner / payout
  S("c8-invite-accept", "POST", "/invites/inv_x/accept", 'top === "invites" && seg[2] === "accept"'),
  S("c8-referral-claim", "POST", "/referrals/claim", 'path === "/referrals/claim"', { code: "ref_x" }),
  S("c8-asset-add", "POST", "/enterprise/ten_x/assets", 'rest === "assets" && m === "POST"', { domain: "matrix-b.example.test", label: "m" }),
  S("c8-asset-verify", "POST", "/enterprise/ten_x/assets/ast_x/verify", 'seg[2] === "assets" && seg[4] === "verify"'),
  S("c8-asset-delete", "DELETE", "/enterprise/ten_x/assets/ast_x", 'seg[2] === "assets" && seg.length === 4 && m === "DELETE"'),
  S("c8-member-invite", "POST", "/enterprise/ten_x/members", 'rest === "members" && m === "POST"', { email: "m@example.test", role: "viewer" }),
  S("c8-member-role", "PATCH", "/enterprise/ten_x/members/acc_x", 'seg[2] === "members" && seg.length === 4 && m === "PATCH"', { role: "viewer" }),
  S("c8-member-remove", "DELETE", "/enterprise/ten_x/members/acc_x", 'seg[2] === "members" && seg.length === 4 && m === "DELETE"'),
  S("c8-sso-put", "PUT", "/enterprise/ten_x/sso", 'rest === "sso" && m === "PUT"', { issuer: "https://idp.mock.test" }),
  S("c8-sso-enforce", "POST", "/enterprise/ten_x/sso/enforce", 'rest === "sso/enforce"', { enabled: false }),
  S("c8-invite-revoke", "DELETE", "/enterprise/ten_x/invites/inv_x", 'seg[2] === "invites" && seg.length === 4 && m === "DELETE"'),
  S("c8-partner-access", "POST", "/enterprise/ten_x/partner-access", 'rest === "partner-access"', { enabled: false }),
  S("c8-portal-create", "POST", "/partners/ptn_x/portals", 'rest === "portals" && m === "POST"', { name: "m" }),
  S("c8-portal-publish", "POST", "/partners/ptn_x/portals/por_x/publish", 'seg[4] === "publish"', { enabled: false }),
  S("c8-brand-put", "PUT", "/partners/ptn_x/brand", 'rest === "brand" && m === "PUT"', { name: "m" }),
  S("c8-payout-request", "POST", "/partners/ptn_x/payouts", 'rest === "payouts" && m === "POST"'),
  PRE("c8-sso-start", "POST", "/sso/ten_x/start", 'seg[2] === "start" && seg.length === 3', {}),
  // Named allow-list: each has its own credential or is stateless. `secret` = the header the route demands; `control` = what the matrix proves instead.
  A("c7-mcp", "POST", "/mcp", "(path === \"/mcp\")", "bearer-key API (Authorization: Bearer tk_...), not a session; a browser has no ambient key", { synthetic: true }),
  A("c2-stripe-webhook", "POST", "/stripe/webhook", 'path === "/stripe/webhook"', "signed webhook (Stripe-Signature HMAC); no browser involvement", { synthetic: true }),
  A("c7-receipt-verify", "POST", "/agent/receipts/verify", 'path === "/agent/receipts/verify"', "stateless: reads nothing, writes nothing, reveals nothing"),
  A("c8-savings-calc", "POST", "/savings", 'path === "/savings" && m === "POST"', "stateless calculator: no store write"),
  A("c8-sso-callback", "POST", "/sso/callback", 'path === "/sso/callback"', "IdP return leg: authenticated by the single-use sealed state + signed id_token, not by a session"),
  A("c4-internal-card-resolve", "POST", "/internal/market/cards/c_x/resolve", 'seg[2] === "cards" && seg[4] === "resolve"', "x-internal-secret operator route (Kyle's tap / cron), never a session", { secret: "x-internal-secret" }),
  A("c4-internal-sweep", "POST", "/internal/market/sweep", 'seg[2] === "sweep"', "x-internal-secret operator route", { secret: "x-internal-secret" }),
  A("c8-internal-payout-retry", "POST", "/internal/enterprise/payouts/retry", 'payouts/retry', "x-internal-secret operator route", { secret: "x-internal-secret" }),
  A("c8-internal-payout-sweep", "POST", "/internal/enterprise/payouts/sweep", 'payouts/sweep', "x-internal-secret operator route", { secret: "x-internal-secret" }),
  A("c8-internal-payout-release", "POST", "/internal/enterprise/payouts/po_x/release", 'seg[2] === "payouts" && m === "POST" && (seg[4]', "x-internal-secret operator route", { secret: "x-internal-secret" }),
  A("c8-internal-tenant-provision", "POST", "/internal/tenants/provision", 'tenants/provision', "x-internal-secret operator route", { secret: "x-internal-secret" }),
  A("c8-internal-sso-enforce", "POST", "/internal/tenants/ten_x/sso-enforce", 'seg[3] === "sso-enforce"', "x-internal-secret operator route", { secret: "x-internal-secret" }),
  A("c8-internal-payout-decide", "POST", "/internal/payouts/po_x/approve", 'seg[1] === "payouts" && seg.length === 4', "x-internal-secret operator route", { secret: "x-internal-secret" }),
];

export function discover() {
  const found = [];
  for (const f of SOURCES) {
    readFileSync(join(ROOT, f), "utf8").split("\n").forEach((line, i) => { if (MUT.test(line)) found.push({ file: f, line: i + 1, text: line.trim() }); });
  }
  // /mcp and /stripe/webhook: /mcp compares `m !== "POST"`, so it is added by hand (the one non-grepable mutating door).
  const idx = readFileSync(join(ROOT, SOURCES[0]), "utf8");
  if (/path === "\/mcp"/.test(idx)) found.push({ file: SOURCES[0], line: idx.split("\n").findIndex((l) => l.includes('path === "/mcp"')) + 1, text: '(path === "/mcp")' });
  if (/path === "\/auth\/logout"/.test(idx)) { /* already matched by MUT */ }
  const claimed = new Map(); const uncovered = [];
  for (const f of found) {
    const hit = ROUTES.filter((r) => f.text.includes(r.sig));
    if (hit.length === 0) uncovered.push(f); else hit.forEach((h) => claimed.set(h.id, f));
  }
  const orphans = ROUTES.filter((r) => !claimed.has(r.id));
  return { found, uncovered, orphans, routes: ROUTES };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = discover();
  if (process.argv.includes("--md")) {
    console.log("| id | method | path | class | reason / auth |\n|---|---|---|---|---|");
    for (const x of r.routes) console.log(`| ${x.id} | ${x.method} | ${x.path} | ${x.kind === "allow" ? "ALLOW-LISTED" : x.kind} | ${x.why ?? (x.kind === "session" ? "Bearer ss_ session" : "no session; origin-checked")} |`);
  }
  console.log(`discovered ${r.found.length} mutating lines, table ${r.routes.length} entries, uncovered ${r.uncovered.length}, orphan entries ${r.orphans.length}`);
  for (const u of r.uncovered) console.log(`UNCOVERED ${u.file}:${u.line} ${u.text.slice(0, 120)}`);
  for (const o of r.orphans) console.log(`ORPHAN ${o.id} sig=${o.sig}`);
  process.exit(r.uncovered.length || r.orphans.length ? 1 : 0);
}
