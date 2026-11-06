import { HttpError, authenticate, type Deps } from "../service.ts";
import * as s from "./service.ts";
import { json, text } from "../http.ts";

async function body(req: Request): Promise<Record<string, unknown>> {
  const t = await req.text();
  if (t.length > 64 * 1024) throw new HttpError(413, "body_too_large");
  if (!t) return {};
  try { const j = JSON.parse(t); return j && typeof j === "object" && !Array.isArray(j) ? j : {}; } catch { throw new HttpError(400, "invalid_json"); }
}

// Returns null when the path is not an enterprise path, so the caller falls through to the C2 routes.
export async function entRoute(req: Request, path: string, d: Deps): Promise<Response | null> {
  if (path === "/api/partner/book") path = "/partner/book";   // C8 f311: the site proxies /api/*; both spellings reach the one guarded handler
  const m = req.method, seg = path.split("/").filter(Boolean);
  const top = seg[0];
  if (!["enterprise", "partners", "sso", "portal", "tenants", "invites", "referrals", "savings", "internal", "partner"].includes(top)) return null;
  if (top === "internal" && seg[1] !== "tenants" && seg[1] !== "payouts" && seg[1] !== "enterprise") return null;
  if (!d.ent) return json({ error: "enterprise_unavailable" }, 503);

  // public
  if (path === "/savings" && m === "POST") return json(s.savings(await body(req)));
  if (top === "portal" && seg.length === 2 && m === "GET") return json(await s.publicBrand(d, seg[1]));
  if (top === "sso" && seg[2] === "start" && seg.length === 3 && m === "POST") return json(await s.ssoStart(d, seg[1], req.headers.get("cf-connecting-ip") ?? "unknown"));
  if (path === "/sso/callback" && m === "POST") return json(await s.ssoCallback(d, await body(req)));

  // operator (INTERNAL_API_SECRET); anything wrong looks like a 404
  if (top === "internal" && seg[1] === "enterprise") {   // C8 f50: strict 401/503 guard, then exactly three routes
    s.checkOperator(d, req.headers.get("x-internal-secret"));
    if (path === "/internal/enterprise/payouts/held" && m === "GET") return json(await s.opHeldPayouts(d, new URL(req.url).searchParams.get("tenantId")));
    if (path === "/internal/enterprise/payouts/retry" && m === "POST") return json(await s.opRetryPayouts(d, await body(req)));
    if (path === "/internal/enterprise/payouts/sweep" && m === "POST") return json(await s.opSweepPayouts(d, await body(req)));
    return json({ error: "not_found" }, 404);
  }
  if (top === "internal") {
    s.checkInternal(d, req.headers.get("x-internal-secret"));
    if (path === "/internal/tenants/provision" && m === "POST") return json(await s.provisionTenant(d, await body(req)), 201);
    if (seg[1] === "tenants" && seg[3] === "sso-enforce" && seg.length === 4 && m === "POST") return json(await s.operatorSetEnforcement(d, seg[2], (await body(req)).enabled));
    if (seg[1] === "payouts" && seg.length === 4 && m === "POST" && (seg[3] === "approve" || seg[3] === "reject")) return json(await s.decidePayout(d, seg[2], seg[3] === "approve"));
    return json({ error: "not_found" }, 404);
  }

  const ctx = await s.authCtx(d, req.headers.get("authorization"), authenticate);
  if (path === "/tenants" && m === "GET") return json(await s.myTenants(d, ctx));
  if (path === "/invites" && m === "GET") return json(await s.myInvites(d, ctx));
  if (top === "invites" && seg[2] === "accept" && m === "POST") return json(await s.acceptInvite(d, ctx, seg[1]));
  if (path === "/referrals/claim" && m === "POST") return json(await s.claimReferral(d, ctx, (await body(req)).code));

  if (path === "/partner/book" && m === "GET") {   // C8 f311: the partner's book of clients; a seat that is not the caller's answers an EMPTY 403
    const u = new URL(req.url).searchParams;
    const r = await s.partnerBook(d, ctx, { partnerId: u.get("partnerId"), limit: u.get("limit"), cursor: u.get("cursor") });
    return r.body === null ? new Response(null, { status: r.status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } }) : json(r.body, r.status);
  }

  if (top === "enterprise" && seg.length >= 2) {
    const tid = seg[1], rest = seg.slice(2).join("/");
    if (rest === "" && m === "GET") { const { tenant, role } = await s.access(d, ctx, tid, "viewer"); return json({ id: tenant.id, name: tenant.name, kind: tenant.kind, role, ssoEnforced: tenant.ssoEnforced, partnerAccess: tenant.partnerAccess }); }
    if (rest === "estate" && m === "GET") return json(await s.estateView(d, ctx, tid, new URL(req.url).searchParams.get("refresh") === "1"));
    if (rest === "estate.csv" && m === "GET") return text(await s.estateCsv(d, ctx, tid), "text/csv; charset=utf-8", { "content-disposition": 'attachment; filename="estate.csv"' });
    if (rest === "assets" && m === "GET") return json(await s.listAssets(d, ctx, tid));
    if (rest === "assets" && m === "POST") return json(await s.addAsset(d, ctx, tid, await body(req)), 201);
    if (seg[2] === "assets" && seg[4] === "verify" && seg.length === 5 && m === "POST") return json(await s.verifyAsset(d, ctx, tid, seg[3]));
    if (seg[2] === "assets" && seg.length === 4 && m === "DELETE") { await s.removeAsset(d, ctx, tid, seg[3]); return json({ ok: true }); }
    if (rest === "members" && m === "GET") return json(await s.listMembers(d, ctx, tid));
    if (rest === "members" && m === "POST") return json(await s.inviteMember(d, ctx, tid, await body(req)), 201);
    if (seg[2] === "members" && seg.length === 4 && m === "PATCH") return json(await s.setRole(d, ctx, tid, seg[3], (await body(req)).role));
    if (seg[2] === "members" && seg.length === 4 && m === "DELETE") { await s.removeMember(d, ctx, tid, seg[3]); return json({ ok: true }); }
    if (rest === "sso" && m === "GET") return json(await s.getSso(d, ctx, tid));
    if (rest === "sso" && m === "PUT") return json(await s.putSso(d, ctx, tid, await body(req)));
    if (rest === "sso/enforce" && m === "POST") return json(await s.enforceSso(d, ctx, tid, (await body(req)).enabled));
    if (seg[2] === "invites" && seg.length === 4 && m === "DELETE") { await s.revokeInvite(d, ctx, tid, seg[3]); return json({ ok: true }); }
    if (rest === "audit" && m === "GET") return json(await s.auditLog(d, ctx, tid));
    if (rest === "partner-access" && m === "POST") return json(await s.setPartnerAccess(d, ctx, tid, (await body(req)).enabled));
  }
  if (top === "partners" && seg.length >= 2) {
    const pid = seg[1], rest = seg.slice(2).join("/");
    if (rest === "portals" && m === "GET") return json(await s.listPortals(d, ctx, pid));
    if (rest === "portals" && m === "POST") return json(await s.createPortal(d, ctx, pid, await body(req)), 201);
    if (seg[2] === "portals" && seg[4] === "estate" && seg.length === 5 && m === "GET") return json(await s.portalEstate(d, ctx, pid, seg[3]));
    if (seg[2] === "portals" && seg[4] === "publish" && seg.length === 5 && m === "POST") return json(await s.publishPortal(d, ctx, pid, seg[3], (await body(req)).enabled));
    if (rest === "brand" && m === "PUT") return json(await s.setBrand(d, ctx, pid, await body(req)));
    if (rest === "ledger" && m === "GET") return json(await s.ledger(d, ctx, pid));
    if (rest === "statement" && m === "GET") return text(await s.partnerStatement(d, ctx, pid, new URL(req.url).searchParams.get("month")), "text/plain; charset=utf-8", { "content-disposition": "inline" });
    if (rest === "payouts" && m === "GET") return json(await s.listPayouts(d, ctx, pid));
    if (rest === "payouts" && m === "POST") return json(await s.requestPayout(d, ctx, pid), 201);
  }
  return json({ error: "not_found", path }, 404);
}
