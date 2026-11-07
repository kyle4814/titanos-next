import { make } from "./harness.ts";
import { MemoryEntStore, type EntStore } from "../src/enterprise/store.ts";
import { D1EntStore, aesGcmSealer } from "../src/enterprise/d1store.ts";
import { FakeD1 } from "./fake_d1.ts";
import { MockIdp } from "../src/enterprise/sso.ts";
import { SyntheticScan } from "../src/enterprise/estate.ts";
import { RATE_V1 } from "../src/enterprise/share.ts";
import type { PayoutProvider, RateTable } from "../src/enterprise/types.ts";

export const INTERNAL = "internal_fixture_secret";
export class MockPayouts implements PayoutProvider {
  sent: { partnerId: string; accountRef: string; amountCents: number; idempotencyKey: string }[] = [];
  fail = false;
  async transfer(p: { partnerId: string; accountRef: string; amountCents: number; idempotencyKey: string }) {
    if (this.fail) throw new Error("provider_down");
    if (this.sent.some((x) => x.idempotencyKey === p.idempotencyKey)) return { ref: "po_dup" };
    this.sent.push(p);
    return { ref: `po_${this.sent.length}` };
  }
}

export const TEST_SEAL_KEY = Buffer.from("test-fixture-key-32-bytes-long!!").toString("base64");   // synthetic, test only
// ENT_STORE=d1 runs the WHOLE enterprise suite against D1EntStore on a FakeD1 (real SQLite + the real migrations). Foreign keys
// are OFF in this mode only because the portal accounts live in MemoryStore here; test/ent_store_contract.test.ts runs FK ON.
export async function makeEntStore(kind = process.env.ENT_STORE ?? "memory"): Promise<EntStore> {
  if (kind !== "d1") return new MemoryEntStore();
  const fake = new FakeD1(); fake.db.exec("PRAGMA foreign_keys = OFF");
  return new D1EntStore(fake, await aesGcmSealer(TEST_SEAL_KEY));
}
export async function makeEnt(rates: RateTable = RATE_V1) {
  const h = make();
  const store = await makeEntStore(), payouts = new MockPayouts();
  h.deps.ent = { store, idp: MockIdp, payouts, scan: SyntheticScan, rates, internalSecret: INTERNAL };
  const ireq = (path: string, body: unknown, secret: string | null = INTERNAL) =>
    h.req("POST", path, { body, headers: secret ? { "x-internal-secret": secret } : {} });
  // sign in, then the operator provisions the seat
  async function provision(kind: "enterprise" | "partner", email: string, name: string, slug: string, extra: Record<string, unknown> = {}) {
    const u = await h.login(email);
    const r = await h.j(await ireq("/internal/tenants/provision", { kind, name, slug, adminEmail: email, ...extra }));
    return { ...u, tenant: r as any };
  }
  const get = async (tok: string | undefined, path: string) => h.j(await h.req("GET", path, { token: tok }));
  const post = async (tok: string | undefined, path: string, body: unknown = {}) => h.j(await h.req("POST", path, { token: tok, body }));
  async function addVerifiedAsset(tok: string, tid: string, domain: string, label = domain) {
    const a = await h.j(await h.req("POST", `/enterprise/${tid}/assets`, { token: tok, body: { domain, label } }));
    h.dns.zone[a.record.name] = [a.record.value];
    const v = await h.j(await h.req("POST", `/enterprise/${tid}/assets/${a.id}/verify`, { token: tok }));
    return { a, v };
  }
  async function configureSso(tok: string, tid: string, domain: string, secret = "sso_secret_fixture_0123456789", extra: Record<string, unknown> = {}) {
    return h.j(await h.req("PUT", `/enterprise/${tid}/sso`, { token: tok, body: { issuer: "https://idp.mock.test", clientId: "client-" + tid.slice(-6), secret, allowedDomains: [domain], ...extra } }));
  }
  // The IdP side: sign an id token for the given tenant config
  async function idToken(cfg: { secret: string; issuer: string; clientId: string }, o: { email: string; nonce: string; exp?: number; iat?: number; aud?: unknown; iss?: string; verified?: unknown; header?: Record<string, unknown>; secret?: string }) {
    const now = Math.floor(h.clock.t / 1000);
    return MockIdp.sign({ secret: o.secret ?? cfg.secret }, { iss: o.iss ?? cfg.issuer, aud: o.aud ?? cfg.clientId, sub: "idp|" + o.email, email: o.email, email_verified: o.verified ?? true, nonce: o.nonce, iat: o.iat ?? now, exp: o.exp ?? now + 300 }, o.header);
  }
  async function ssoLogin(slug: string, cfg: { secret: string; issuer: string; clientId: string }, email: string, tweak: Partial<Parameters<typeof idToken>[1]> = {}) {
    const st = await h.j(await h.req("POST", `/sso/${slug}/start`));
    const id_token = await idToken(cfg, { email, nonce: st.nonce, ...tweak });
    const res = await h.req("POST", "/sso/callback", { body: { state: st.state, nonce: st.nonce, id_token } });
    return { st, id_token, res, body: await h.j(res.clone()) };
  }
  return { ...h, store, payouts, ireq, provision, get, post, addVerifiedAsset, configureSso, idToken, ssoLogin };
}
export const SSO_CFG = (clientId: string, secret = "sso_secret_fixture_0123456789") => ({ secret, issuer: "https://idp.mock.test", clientId });
