// C8 self-serve dossier request core. Pure TypeScript, ZERO model calls, ZERO network.
// The ownership gate mirrors the C2 contract in portal-api/src/dns.ts (same TXT name and value shape);
// scripts/test_dossier_selfserve.mjs asserts parity with the real file. Passive public DNS only (DEL1):
// the resolver is injected, tests and the preview use an in-memory zone.
// Output is SYNTHETIC and labelled. A real dossier is a separate, gated build.

export type Phase = "idle" | "awaiting_txt" | "verified" | "queued" | "ready";
export type ErrorCode = "invalid_domain" | "txt_not_found" | "dns_lookup_failed" | "not_verified" | "not_found" | "not_ready";

export interface TxtResolver { txt(name: string): Promise<string[]> }
export interface DossierRequest {
  id: string;
  domain: string;
  token: string;
  phase: Phase;
  record: { type: "TXT"; name: string; value: string };
  verifiedAt?: number;
  queuedAt?: number;
  readyAt?: number;
}
export interface SyntheticDossier { synthetic: true; label: string; domain: string; sections: { heading: string; body: string }[] }
export class DossierError extends Error { code: ErrorCode; constructor(code: ErrorCode) { super(code); this.code = code; } }

export interface DossierAdapter {
  start(domainInput: string): Promise<DossierRequest>;
  verify(id: string): Promise<DossierRequest>;
  queue(id: string): Promise<DossierRequest>;
  poll(id: string): Promise<DossierRequest>;
  result(id: string): Promise<SyntheticDossier>;
}

export function normaliseDomain(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let d = input.trim().toLowerCase().replace(/\.$/, "");
  d = d.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (d.length > 253 || !d.includes(".")) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(d) || d.includes(":")) return null;
  const labels = d.split(".");
  if (!labels.every((l) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(l))) return null;
  if (!/^[a-z]{2,}$/.test(labels[labels.length - 1])) return null;
  if (["localhost", "local", "internal", "test", "invalid", "example"].includes(labels[labels.length - 1])) return null;
  return d;
}
export const verifyRecordName = (domain: string) => `_titanos-verify.${domain}`;
export const verifyRecordValue = (token: string) => `titanos-verify=${token}`;

export const SYNTHETIC_LABEL = "SYNTHETIC PREVIEW: sample layout only, not a real assessment of this domain.";

export function syntheticDossier(domain: string): SyntheticDossier {
  return {
    synthetic: true,
    label: SYNTHETIC_LABEL,
    domain,
    sections: [
      { heading: "What this is", body: "A sample of the layout your dossier will use. Every line below is placeholder text." },
      { heading: "Email security posture", body: "Placeholder: SPF, DMARC and DKIM findings would appear here, read from public DNS records only." },
      { heading: "Plain-English next steps", body: "Placeholder: three fixes in order, each with the exact record to publish." },
    ],
  };
}

export interface MemoryOptions { resolver: TxtResolver; now?: () => number; readyAfterMs?: number; newToken?: () => string }

// In-memory adapter: runs locally and in tests. A queued request becomes ready once readyAfterMs has passed.
export function memoryAdapter(opts: MemoryOptions): DossierAdapter {
  const now = opts.now ?? (() => Date.now());
  const readyAfter = opts.readyAfterMs ?? 2000;
  let n = 0;
  const newToken = opts.newToken ?? (() => `v${(++n).toString(36).padStart(4, "0")}`);
  const rows = new Map<string, DossierRequest>();
  const get = (id: string) => { const r = rows.get(id); if (!r) throw new DossierError("not_found"); return r; };
  const snap = (r: DossierRequest): DossierRequest => ({ ...r, record: { ...r.record } });
  return {
    async start(input) {
      const domain = normaliseDomain(input);
      if (!domain) throw new DossierError("invalid_domain");
      const token = newToken();
      const r: DossierRequest = { id: `dos_${rows.size + 1}`, domain, token, phase: "awaiting_txt", record: { type: "TXT", name: verifyRecordName(domain), value: verifyRecordValue(token) } };
      rows.set(r.id, r);
      return snap(r);
    },
    async verify(id) {
      const r = get(id);
      if (r.phase !== "awaiting_txt") return snap(r);
      let values: string[];
      try { values = await opts.resolver.txt(r.record.name); } catch { throw new DossierError("dns_lookup_failed"); }
      if (!values.includes(r.record.value)) throw new DossierError("txt_not_found");
      r.phase = "verified"; r.verifiedAt = now();
      return snap(r);
    },
    async queue(id) {
      const r = get(id);
      if (r.phase === "awaiting_txt") throw new DossierError("not_verified");
      if (r.phase === "verified") { r.phase = "queued"; r.queuedAt = now(); }
      return snap(r);
    },
    async poll(id) {
      const r = get(id);
      if (r.phase === "queued" && now() - (r.queuedAt ?? 0) >= readyAfter) { r.phase = "ready"; r.readyAt = now(); }
      return snap(r);
    },
    async result(id) {
      const r = await this.poll(id);
      if (r.phase !== "ready") throw new DossierError("not_ready");
      return syntheticDossier(r.domain);
    },
  };
}

export const ERROR_COPY: Record<ErrorCode, string> = {
  invalid_domain: "That does not look like a domain. Try something like yourbusiness.com.au",
  txt_not_found: "We could not see that record yet. DNS changes can take a few minutes. Check the name and value, then try again.",
  dns_lookup_failed: "The public DNS lookup did not answer just now. Please try again in a minute.",
  not_verified: "Verify the domain first. We only prepare a dossier for a domain you control.",
  not_found: "That request was not found. Start again with your domain.",
  not_ready: "The dossier is not ready yet.",
};
