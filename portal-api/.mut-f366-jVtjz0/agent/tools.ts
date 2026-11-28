// The agent tool catalogue (C7). One definition list feeds: the MCP tools/list, the agent card, llms.txt and the
// /agents page, so they cannot drift (a test pins the generated files to this list). Every tool is code-only
// except explain_finding, which is the one model-backed tool: it runs on the caller's own key (BYOK) or on
// prepaid credits, so no model cost is ever fronted by TITANOS (CORE fence 21).
import { PRODUCTS } from "../catalogue.ts";
import { normaliseDomain, type TxtResolver } from "../dns.ts";
import type { Account } from "../store.ts";
import type { Deps } from "../service.ts";
import { verifyWithRing, ringOf } from "./receipt.ts"; // own receipts only; a third party uses the public POST /agent/receipts/verify

export interface ModelClient { complete(opts: { apiKey: string | "platform"; prompt: string }): Promise<string> }
export type Scope = "catalogue:read" | "scan:read" | "account:read" | "credits:read" | "explain:model" | "receipt:verify";
export const SCOPES: readonly Scope[] = ["catalogue:read", "scan:read", "account:read", "credits:read", "explain:model", "receipt:verify"];

export interface ToolCtx { d: Deps; account: Account; args: Record<string, any>; byokKey?: string }
export interface ToolDef {
  name: string; title: string; description: string; scope: Scope;
  credits: number;            // prepaid cost per call (1 credit = AU$0.01, EXAMPLE rate)
  modelBacked: boolean;       // true = may use a model; BYOK waives credits
  input: { required: string[]; properties: Record<string, { type: "string"; maxLength: number; enum?: string[]; description: string }> };
  run(c: ToolCtx): Promise<unknown>;
}

// ---- passive DNS checks (public records only, DEL1) ----
export interface DomainFinding { id: string; severity: "high" | "medium" | "info"; detail: string }
export async function checkDomainDns(r: TxtResolver, domain: string): Promise<{ domain: string; grade: "A" | "B" | "C" | "D"; findings: DomainFinding[]; checked: string[] }> {
  const findings: DomainFinding[] = [];
  const txt = async (n: string) => { try { return await r.txt(n); } catch { return null; } };
  const root = await txt(domain), dm = await txt(`_dmarc.${domain}`);
  if (root === null || dm === null) findings.push({ id: "dns_lookup_failed", severity: "info", detail: "A public DNS lookup failed, so this result is incomplete. Not proof of absence." });
  const spf = (root ?? []).filter((v) => /^v=spf1\b/i.test(v));
  if (root !== null) {
    if (spf.length === 0) findings.push({ id: "spf_missing", severity: "high", detail: "No SPF record published." });
    else if (spf.length > 1) findings.push({ id: "spf_multiple", severity: "high", detail: "More than one SPF record; receivers treat this as an error." });
    else if (/\+all\b/i.test(spf[0])) findings.push({ id: "spf_allow_all", severity: "high", detail: "SPF ends in +all, which authorises anyone to send as this domain." });
    else if (/\s\?all\b/i.test(spf[0]) || /\s~all\b/i.test(spf[0])) findings.push({ id: "spf_soft", severity: "info", detail: "SPF uses a soft fail (~all or ?all)." });
  }
  const dmarc = (dm ?? []).find((v) => /^v=DMARC1\b/i.test(v));
  if (dm !== null) {
    if (!dmarc) findings.push({ id: "dmarc_missing", severity: "high", detail: "No DMARC record published." });
    else {
      const p = /;\s*p=(\w+)/i.exec(dmarc.replace(/^v=DMARC1\s*/i, "; "))?.[1]?.toLowerCase();
      if (p === "none") findings.push({ id: "dmarc_not_enforced", severity: "medium", detail: "DMARC is published with p=none, so spoofed mail is not blocked." });
      else if (p !== "quarantine" && p !== "reject") findings.push({ id: "dmarc_invalid", severity: "medium", detail: "DMARC record has no valid p= policy." });
    }
  }
  const high = findings.filter((f) => f.severity === "high").length, med = findings.filter((f) => f.severity === "medium").length;
  const grade = high >= 2 ? "D" : high === 1 ? "C" : med ? "B" : "A";
  return { domain, grade, findings, checked: [domain, `_dmarc.${domain}`] };
}

const HELP: Record<string, string> = {
  spf_missing: "Publish a TXT record on the domain starting v=spf1 and listing the services that send your mail, ending in -all.",
  dmarc_missing: "Publish a TXT record at _dmarc.<domain> with v=DMARC1; p=none; rua=mailto:<you>, watch reports, then move to quarantine and reject.",
  dmarc_not_enforced: "Move DMARC from p=none to p=quarantine, then p=reject, once the reports show your real senders pass.",
};

export const TOOLS: ToolDef[] = [
  { name: "catalogue_list", title: "List the catalogue", description: "Every product TITANOS sells, with the price in AUD cents (no GST). Pure lookup, no model.", scope: "catalogue:read", credits: 0, modelBacked: false,
    input: { required: [], properties: {} },
    async run() { return { products: Object.values(PRODUCTS).map((p) => ({ id: p.id, name: p.name, amountCents: p.amountCents, currency: "aud", mode: p.mode, interval: p.interval ?? null })) }; } },
  { name: "price_quote", title: "Quote one product", description: "Price, billing mode and minimum term for one product id. Pure lookup, no model.", scope: "catalogue:read", credits: 0, modelBacked: false,
    input: { required: ["product"], properties: { product: { type: "string", maxLength: 40, description: "A product id from catalogue_list." } } },
    async run({ args }) { const p = PRODUCTS[args.product]; if (!p) throw new ToolError("unknown_product"); return { id: p.id, name: p.name, amountCents: p.amountCents, currency: "aud", gstIncluded: false, mode: p.mode, interval: p.interval ?? null, minMonths: p.minMonths ?? null, needsVerifiedDomain: p.needsVerifiedDomain }; } },
  { name: "domain_check", title: "Passive email-security check", description: "Reads the public SPF and DMARC records of a domain and grades them. Passive public DNS only, nothing is touched or probed, no model.", scope: "scan:read", credits: 5, modelBacked: false,
    input: { required: ["domain"], properties: { domain: { type: "string", maxLength: 253, description: "A public domain, for example example.com.au." } } },
    async run({ d, args }) { const dom = normaliseDomain(args.domain); if (!dom) throw new ToolError("invalid_domain"); return checkDomainDns(d.dns, dom); } },
  { name: "my_domains", title: "List my domains", description: "The domains on your account and whether each is verified.", scope: "account:read", credits: 0, modelBacked: false,
    input: { required: [], properties: {} },
    async run({ d, account }) { return { domains: (await d.store.domainsFor(account.id)).map((x) => ({ domain: x.domain, verified: !!x.verifiedAt })) }; } },
  { name: "credits_balance", title: "Credit balance", description: "Your prepaid credit balance and the last 20 ledger entries. 1 credit = AU$0.01 (example rate).", scope: "credits:read", credits: 0, modelBacked: false,
    input: { required: [], properties: {} },
    async run({ d, account }) { return { balance: await d.store.creditBalance(account.id), recent: (await d.store.creditEntries(account.id)).slice(-20).map(({ delta, reason, ref, at }) => ({ delta, reason, ref, at })) }; } },
  { name: "explain_finding", title: "Explain a finding (model-backed)", description: "Plain-English explanation and fix steps for a finding id from domain_check. Runs on your own model key (header x-model-key, never stored) or on prepaid credits.", scope: "explain:model", credits: 25, modelBacked: true,
    input: { required: ["finding"], properties: { finding: { type: "string", maxLength: 40, enum: Object.keys(HELP), description: "A finding id." } } },
    async run({ d, args, byokKey }) {
      if (!d.model) throw new ToolError("model_unavailable");
      const text = await d.model.complete({ apiKey: byokKey ?? "platform", prompt: `Explain in two plain sentences, for a small business owner, what this means and how to fix it: ${args.finding}. Known fix: ${HELP[args.finding]}` });
      return { finding: args.finding, explanation: text, fix: HELP[args.finding] };
    } },
  { name: "receipt_verify", title: "Verify a TITANOS receipt", description: "Checks that a receipt your own key was given was really issued by TITANOS and not altered. Free.", scope: "receipt:verify", credits: 0, modelBacked: false,
    input: { required: ["receipt_id"], properties: { receipt_id: { type: "string", maxLength: 40, description: "A receipt id (rcpt_...)." } } },
    async run({ d, args, account }) { const r = await d.store.receiptById(args.receipt_id, account.id); if (!r || r.accountId !== account.id) return { found: false }; return { found: true, valid: await verifyWithRing(ringOf(d), r), tool: r.tool, at: r.at, credits: r.credits, mode: r.mode }; } },
];
export class ToolError extends Error { code: string; constructor(code: string) { super(code); this.code = code; } }
export const toolByName = (n: string) => TOOLS.find((t) => t.name === n);
export const publicTool = (t: ToolDef) => ({ name: t.name, title: t.title, description: t.description, scope: t.scope, credits: t.credits, modelBacked: t.modelBacked, inputSchema: { type: "object", required: t.input.required, properties: t.input.properties, additionalProperties: false } });
