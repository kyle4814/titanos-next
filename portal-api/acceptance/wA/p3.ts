import { make } from "../../test/harness.ts";
import { SCOPES } from "../../src/agent/tools.ts";
const out: string[] = []; const rec = (id: string, held: boolean, note: string) => out.push(`${held ? "HELD  " : "BREACH"} ${id}: ${note}`);
const h = make(); let rid = 0;
const mkAgent = async (email: string, scopes = [...SCOPES]) => { const s = await h.login(email); const k = await h.j(await h.req("POST", "/keys", { token: s.session, body: { scopes } })); return { session: s.session, id: s.account.id, key: k.key as string, keyId: k.id }; };
const rpc = (key: string | undefined, method: string, params?: unknown, headers: Record<string, string> = {}) => h.req("POST", "/mcp", { token: key, body: { jsonrpc: "2.0", id: ++rid, method, params }, headers });
const call = async (key: string, name: string, args: unknown = {}, headers: Record<string, string> = {}) => { const r = await h.j(await rpc(key, "tools/call", { name, arguments: args }, headers)); return r.result ? { structuredContent: r.result.structuredContent, isError: r.result.isError } : r; };
h.dns.zone["good.example.com.au"] = ["v=spf1 -all"];
const A = await mkAgent("a@ag.example.com"), B = await mkAgent("b@ag.example.com");
// cross-account receipt verify
const ra = await call(A.key, "domain_check", { domain: "good.example.com.au" }); // costs 5 credits -> needs credits
rec("AG-prepaid-needs-credit", ra.result?.structuredContent?.error ?? ra.structuredContent?.error ? true : false, JSON.stringify(ra).slice(0, 160));
// give A credits via direct store (test backdoor)
await h.store.creditApply(A.id, 1000, "topup", "t1", h.clock.t);
const rc = await call(A.key, "catalogue_list"); const rcpt = rc.structuredContent?.receipt;
const xv = await call(B.key, "receipt_verify", { receipt_id: rcpt.id });
rec("AG-receipt-cross-account", xv.structuredContent?.result?.found === false, JSON.stringify(xv.structuredContent?.result));
// forged receipt via public verify
const forged = { ...rcpt, credits: 0, tool: "x" };
const fv = await h.j(await h.req("POST", "/agent/receipts/verify", { body: { receipt: forged } }));
rec("AG-receipt-forged", fv.valid === false, `forged valid=${fv.valid}`);
const gv = await h.j(await h.req("POST", "/agent/receipts/verify", { body: { receipt: rcpt } }));
rec("AG-receipt-genuine", gv.valid === true, `genuine valid=${gv.valid}`);
// scope escalation
const lim = await mkAgent("lim@ag.example.com", ["catalogue:read"]);
const sd = await call(lim.key, "my_domains"); rec("AG-scope", sd.structuredContent?.error === "scope_denied", JSON.stringify(sd.structuredContent));
const tl = await h.j(await rpc(lim.key, "tools/list")); rec("AG-scope-list", tl.result.tools.map((t: any) => t.name).join() === "catalogue_list,price_quote", tl.result.tools.map((t: any) => t.name).join());
// key creation with unknown scope
const bk = await h.j(await h.req("POST", "/keys", { token: A.session, body: { scopes: ["admin", "catalogue:read"] } })); rec("AG-unvalidated-scope-string", !bk.scopes?.includes("admin"), `unknown scope stored: ${JSON.stringify(bk.scopes)} (backlog: harmless today, pre-grants any future tool scope named admin)`);
// key via MCP key cannot hit session routes
const sr = await h.req("GET", "/me", { token: A.key }); rec("AG-key-as-session", sr.status === 401, `${sr.status}`);
// rate limit race
const ps = await Promise.all(Array.from({ length: 150 }, () => call(A.key, "catalogue_list")));
const okc = ps.filter((x) => x.structuredContent?.receipt).length; rec("AG-ratelimit-race", okc <= 60, `150 concurrent -> ${okc} served (limit 60/min; ${okc>60?"overshoot":"ok"})`);
// credit race
h.clock.t += 120_000;
const C = await mkAgent("c@ag.example.com"); await h.store.creditApply(C.id, 25, "topup", "t2", h.clock.t);
const cr = await Promise.all(Array.from({ length: 10 }, (_, i) => call(C.key, "explain_finding", { finding: "spf_missing" }, { "idempotency-key": "k" + i })));
const served = cr.filter((x) => x.structuredContent?.receipt).length; const bal = await h.store.creditBalance(C.id);
rec("AG-credit-race", served === 1 && bal === 0, `balance 25, 10 concurrent x25 credits -> served ${served}, balance ${bal}`);
// byok leak
const SECRETKEY = "sk-ant-SECRET-LEAKCHECK-123";
h.clock.t += 120_000;
const by = await call(C.key, "explain_finding", { finding: "spf_missing" }, { "x-model-key": SECRETKEY });
const dump = JSON.stringify([by, [...h.store.receipts.values()], [...h.store.creditEntries ? [] : []]]) + JSON.stringify(Object.fromEntries(Object.entries(h.store).map(([k, v]) => [k, v instanceof Map ? [...v.entries()] : v])));
rec("AG-byok-not-stored", !dump.includes(SECRETKEY), `byok mode=${by.structuredContent?.receipt?.mode}, key present in store/response dump: ${dump.includes(SECRETKEY)}`);
const model = (h as any).model; rec("AG-byok-used", model.calls.at(-1)?.apiKey === SECRETKEY, "model got the caller key, not platform");
// model failure with byok key leaking in error
model.fail = true; const bf = await call(C.key, "explain_finding", { finding: "spf_missing" }, { "x-model-key": SECRETKEY }); rec("AG-byok-fail-leak", !JSON.stringify(bf).includes(SECRETKEY), JSON.stringify(bf).slice(0, 120)); model.fail = false;
// idempotency with different args
h.clock.t += 120_000;
const i1 = await call(A.key, "price_quote", { product: Object.keys((await import("../../src/catalogue.ts")).PRODUCTS)[0] }, { "idempotency-key": "same" });
const i2 = await call(A.key, "price_quote", { product: "nonexistent" }, { "idempotency-key": "same" });
rec("AG-idem-different-args", !i2.structuredContent?.replayed, `same key, different args -> replayed=${i2.structuredContent?.replayed} (returns first call's receipt for an unrelated request)`);
// idempotency cross-key
const i3 = await call(B.key, "price_quote", { product: "x" }, { "idempotency-key": "same" }); rec("AG-idem-cross-key", !i3.structuredContent?.replayed, "");
// SSRF-ish domain_check inputs
for (const dm of ["localhost", "127.0.0.1", "169.254.169.254", "a", "[::1]", "good.example.com.au/../../etc", "x".repeat(300), "good.example.com.au\n.evil.com"]) {
  h.clock.t += 61_000; const r = await call(A.key, "domain_check", { domain: dm }); const ok = r.structuredContent?.result; const err = r.structuredContent?.error ?? r.error?.message;
  if (ok && !/^good\.example\.com\.au/.test(dm)) rec("AG-domain-input-" + dm.slice(0, 20), false, `accepted: ${JSON.stringify(ok).slice(0, 80)}`);
}
// proto names
for (const n of ["__proto__", "constructor", "toString"]) { const r = await h.j(await rpc(A.key, "tools/call", { name: n, arguments: {} })); rec("AG-proto-" + n, !!r.error, JSON.stringify(r).slice(0, 80)); }
// failed call not charged
const before = await h.store.creditBalance(A.id); await call(A.key, "domain_check", { domain: "bad domain" }); rec("AG-failed-uncharged", before === (await h.store.creditBalance(A.id)), "");
// 10 external agents each get a receipt
let n = 0; for (let i = 0; i < 10; i++) { const x = await mkAgent(`ext${i}@ag.example.com`); const r = await call(x.key, "catalogue_list"); const v = await h.j(await h.req("POST", "/agent/receipts/verify", { body: { receipt: r.structuredContent.receipt } })); if (v.valid) n++; }
rec("C7-kill-10-agents", n === 10, `${n}/10 agents received a verifiable receipt`);
console.log(out.join("\n"));
