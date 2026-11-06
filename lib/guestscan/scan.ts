// C1 guest scan core. Pure TypeScript, no dependencies, ZERO model calls.
// Port of the SpoofGuard email-security checks (spoofguard/scanner.py, read
// 2026-11-06) over public DNS-over-HTTPS. Passive: public DNS records only,
// nothing on the owner's servers is touched.
//
// Rule kept from SpoofGuard: a failed read is UNKNOWN, never "absent".

import { RequestMeter, meteredFetch, type FetchLike } from "./meter.ts";

export type Status = "PASS" | "WARN" | "FAIL" | "UNKNOWN";
export interface Finding {
  check: string; // SPF, DMARC, DKIM, DNSSEC, MX, MTA-STS
  status: Status;
  detail: string;
  fix: string; // plain-English remediation, "" on PASS
}
export interface DohAnswer { name?: string; type?: number; data?: string }
export interface DohResponse { Status?: number; Answer?: DohAnswer[] }
// The only network seam. Tests inject a fake; the browser uses dohFetch().
// A DohFetch may carry the RequestMeter that counts its outbound requests (dohFetch always does).
export type DohFetch = ((name: string, rrtype: string) => Promise<DohResponse>) & { meter?: RequestMeter };

export const DOH_HOSTS = ["cloudflare-dns.com", "dns.google"] as const;
export const DKIM_SELECTORS = ["default", "google", "selector1", "selector2", "k1", "mail", "dkim", "s1", "s2", "zoho", "mandrill", "sendgrid"] as const;
export const CRITICAL = new Set(["SPF", "DMARC", "DKIM"]);

export class LookupFailed extends Error {}

// Hostname check shared in spirit with lib/monitorDomain.ts.
const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
export function normaliseDomain(input: string): string {
  return input.trim().replace(/^https?:\/\//i, "").replace(/[/?#].*$/, "").replace(/^www\./i, "").replace(/\.$/, "").toLowerCase();
}
export function isScannable(d: string): boolean { return HOSTNAME_RE.test(d); }

export function dohFetch(host: (typeof DOH_HOSTS)[number] = "cloudflare-dns.com", timeoutMs = 6000, impl?: FetchLike, meter: RequestMeter = new RequestMeter()): DohFetch {
  const mf = meteredFetch(meter, impl);
  const base = host === "dns.google" ? "https://dns.google/resolve" : "https://cloudflare-dns.com/dns-query";
  const doh: DohFetch = async (name, rrtype) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await mf(`${base}?name=${encodeURIComponent(name)}&type=${rrtype}`, { headers: { Accept: "application/dns-json" }, signal: ctl.signal });
      if (!r.ok) throw new Error(`http ${r.status}`);
      return (await r.json()) as DohResponse;
    } finally { clearTimeout(t); }
  };
  doh.meter = meter;
  return doh;
}

async function query(name: string, rrtype: string, f: DohFetch): Promise<DohResponse> {
  let d: DohResponse;
  try { d = await f(name, rrtype); } catch (e) { throw new LookupFailed(`fetch failed for ${name}/${rrtype}`); }
  if (!d || typeof d !== "object") throw new LookupFailed(`unparseable response for ${name}/${rrtype}`);
  // Only NOERROR (0) and NXDOMAIN (3) are real answers; SERVFAIL etc. is a failed read.
  if (d.Status !== undefined && d.Status !== 0 && d.Status !== 3) throw new LookupFailed(`rcode ${d.Status} for ${name}/${rrtype}`);
  return d;
}
async function txt(name: string, f: DohFetch): Promise<string[]> {
  const d = await query(name, "TXT", f);
  return (d.Answer ?? []).map((a) => String(a.data ?? "").replace(/" "/g, "").replace(/^"|"$/g, "").trim()).filter(Boolean);
}
export function tag(rec: string, t: string): string {
  for (const part of rec.split(";")) {
    const i = part.indexOf("=");
    if (i >= 0 && part.slice(0, i).trim().toLowerCase() === t) return part.slice(i + 1).trim().toLowerCase();
  }
  return "";
}
const hasKey = (rec: string) => tag(rec.replace(/" "/g, "").trim().replace(/^"|"$/g, ""), "p").replace(/^"|"$/g, "").trim() !== "";
const F = (check: string, status: Status, detail: string, fix = ""): Finding => ({ check, status, detail, fix });

async function spf(domain: string, f: DohFetch): Promise<Finding> {
  const recs = (await txt(domain, f)).filter((r) => r.toLowerCase().startsWith("v=spf1"));
  if (!recs.length) return F("SPF", "FAIL", "No SPF record: anyone can forge email from this domain.", "Publish an SPF TXT record listing your mail senders, ending in -all (hard fail).");
  if (recs.length > 1) return F("SPF", "FAIL", `Multiple SPF records (${recs.length}): receivers ignore SPF entirely, so the domain is spoofable despite having SPF.`, "Publish exactly ONE SPF TXT record: merge every sender into a single v=spf1 record ending in -all.");
  const s = recs[0];
  // First `all` mechanism wins (RFC 7208 4.6.2); a bare `all` means +all.
  const a = s.toLowerCase().split(/\s+/).find((t) => t.replace(/^[+\-~?]+/, "") === "all");
  if (a === "-all") return F("SPF", "PASS", `Strong SPF (hard fail): ${s}`);
  if (a === "+all" || a === "all") return F("SPF", "FAIL", `SPF authorises ALL senders (${a}): worse than no SPF: ${s}`, "Change the SPF record's ending to -all (hard fail). Never use +all.");
  if (a === "~all" || a === "?all") return F("SPF", "WARN", `SPF present but soft or neutral, not enforced (${a}): ${s}`, "Change the SPF record's ending to -all so forged mail is rejected, not just flagged.");
  return F("SPF", "WARN", `SPF present, no explicit all mechanism: ${s}`, "Add a -all mechanism to the end of the SPF record.");
}
async function dmarc(domain: string, f: DohFetch): Promise<Finding> {
  const recs = (await txt(`_dmarc.${domain}`, f)).filter((r) => r.toLowerCase().startsWith("v=dmarc1"));
  if (!recs.length) return F("DMARC", "FAIL", "No DMARC record: no policy for forged mail and no visibility of abuse.", "Publish a _dmarc TXT record, start at p=none with rua reporting, then move to p=quarantine and p=reject.");
  if (recs.length > 1) return F("DMARC", "FAIL", `Multiple DMARC records (${recs.length}): receivers ignore DMARC entirely, so forged mail is not blocked.`, "Publish exactly ONE _dmarc TXT record.");
  const r = recs[0], p = tag(r, "p"), pct = tag(r, "pct");
  const weak = /^\d+$/.test(pct) && Number(pct) < 100;
  if (p === "reject" && !weak) return F("DMARC", "PASS", `Enforcing DMARC (p=reject): ${r}`);
  if (p === "reject") return F("DMARC", "WARN", `DMARC p=reject but only pct=${pct}% enforced: ${r}`, "Set pct=100 (or remove the pct tag) so the reject policy applies to all forged mail.");
  if (p === "quarantine") return F("DMARC", "WARN", `DMARC quarantining, not rejecting (p=quarantine)${weak ? ` and only pct=${pct}% enforced` : ""}: ${r}`, "Once reports look clean, move the policy to p=reject with pct=100.");
  return F("DMARC", "WARN", `DMARC in monitor-only mode (p=${p || "none"}): ${r}`, "p=none only watches. Move to p=quarantine then p=reject to actually block forged mail.");
}
async function dkim(domain: string, f: DohFetch): Promise<Finding> {
  const res = await Promise.all(DKIM_SELECTORS.map(async (sel) => {
    const d = await query(`${sel}._domainkey.${domain}`, "TXT", f);
    return (d.Answer ?? []).some((a) => hasKey(String(a.data ?? ""))) ? sel : "";
  }));
  const found = res.filter(Boolean);
  if (found.length) return F("DKIM", "PASS", `DKIM signing keys found (selectors: ${found.join(", ")}).`);
  return F("DKIM", "WARN", "No DKIM key found at common selectors (a custom selector may be in use: confirm with your mail provider).", "Enable DKIM signing with your mail provider and publish the key so receivers can verify your mail.");
}
async function dnssec(domain: string, f: DohFetch): Promise<Finding> {
  const d = await query(domain, "DS", f);
  if (d.Answer?.length) return F("DNSSEC", "PASS", "DNSSEC enabled (DS record present).");
  return F("DNSSEC", "WARN", "DNSSEC not enabled: DNS responses are not cryptographically signed.", "Enable DNSSEC at your DNS host.");
}
async function mx(domain: string, f: DohFetch): Promise<Finding> {
  const d = await query(domain, "MX", f);
  const hosts = [...new Set((d.Answer ?? []).map((a) => String(a.data ?? "").split(/\s+/).pop()!.replace(/\.$/, "")).filter(Boolean))].sort();
  if (hosts.length) return F("MX", "PASS", `Mail servers configured: ${hosts.join(", ")}`);
  return F("MX", "WARN", "No MX records: this domain does not receive email, or is misconfigured.", "If this domain should receive mail, add MX records.");
}
async function mtasts(domain: string, f: DohFetch): Promise<Finding> {
  const r = (await txt(`_mta-sts.${domain}`, f)).find((x) => x.toLowerCase().startsWith("v=stsv1"));
  if (r) return F("MTA-STS", "PASS", "MTA-STS present: enforces TLS on inbound mail.");
  return F("MTA-STS", "WARN", "No MTA-STS: inbound mail can be delivered over unencrypted connections.", "Publish an MTA-STS policy to require TLS for mail to your domain (optional, best practice).");
}

const CHECKS: [string, (d: string, f: DohFetch) => Promise<Finding>][] = [["SPF", spf], ["DMARC", dmarc], ["DKIM", dkim], ["DNSSEC", dnssec], ["MX", mx], ["MTA-STS", mtasts]];

export interface ScanResult {
  domain: string;
  findings: Finding[];
  grade: "A" | "B" | "C" | "D" | "F" | "?";
  score: number; // 0-100 or -1 when unreadable
  elapsedMs: number;
  modelCalls: number; // MEASURED: outbound requests to a known model API host (lib/modelhosts.ts), counted by the meter
  outbound: { total: number; hosts: string[] }; // MEASURED: requests this scan made and the host set
}

export function grade(findings: Finding[]): { grade: ScanResult["grade"]; score: number } {
  const known = findings.filter((x) => x.status !== "UNKNOWN");
  if (!known.length || findings.filter((x) => CRITICAL.has(x.check) && x.status === "UNKNOWN").length === 3) return { grade: "?", score: -1 };
  // Critical controls weigh 20 each, the rest 10 (total 100). WARN earns half.
  let got = 0, max = 0;
  for (const x of known) {
    const w = CRITICAL.has(x.check) ? 20 : 10;
    max += w; got += x.status === "PASS" ? w : x.status === "WARN" ? w / 2 : 0;
  }
  let score = Math.round((got / max) * 100);
  // A FAIL on any critical control caps the grade: the domain is spoofable.
  const critFail = known.some((x) => CRITICAL.has(x.check) && x.status === "FAIL");
  if (critFail) score = Math.min(score, 49);
  const g = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  return { grade: g, score };
}

export async function runScan(input: string, f: DohFetch, now: () => number = Date.now): Promise<ScanResult> {
  const domain = normaliseDomain(input);
  if (!isScannable(domain)) throw new Error("invalid_domain");
  const t0 = now();
  const meter = f.meter ?? new RequestMeter();
  const before = meter.snapshot();
  // All checks (and all 12 DKIM selectors) run in parallel: one round of lookups, not 17 in a row.
  const findings = await Promise.all(CHECKS.map(async ([name, fn]) => {
    try { return await fn(domain, f); }
    catch (e) { return F(name, "UNKNOWN", "Could not read this record just now. This is not a pass or a fail.", ""); }
  }));
  const g = grade(findings);
  const after = meter.snapshot();
  return { domain, findings, ...g, elapsedMs: now() - t0, modelCalls: after.modelCalls - before.modelCalls, outbound: { total: after.total - before.total, hosts: [...new Set(meter.log.slice(before.at))].sort() } };
}
