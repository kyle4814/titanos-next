// C1 guest scan core. Pure TypeScript, no dependencies, ZERO model calls.
// Port of the SpoofGuard email-security checks (spoofguard/scanner.py, read
// 2026-11-06) over public DNS-over-HTTPS. Passive: public DNS records only,
// nothing on the owner's servers is touched.
//
// Rule kept from SpoofGuard: a failed read is UNKNOWN, never "absent".
import { spfNestedLookups, dohSpfResolver } from "./spfnest.ts";

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
export type DohFetch = (name: string, rrtype: string) => Promise<DohResponse>;

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

export function dohFetch(host: (typeof DOH_HOSTS)[number] = "cloudflare-dns.com", timeoutMs = 6000): DohFetch {
  const base = host === "dns.google" ? "https://dns.google/resolve" : "https://cloudflare-dns.com/dns-query";
  return async (name, rrtype) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(`${base}?name=${encodeURIComponent(name)}&type=${rrtype}`, { headers: { Accept: "application/dns-json" }, signal: ctl.signal });
      if (!r.ok) throw new Error(`http ${r.status}`);
      return (await r.json()) as DohResponse;
    } finally { clearTimeout(t); }
  };
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

// SPF record helpers (RFC 7208). A record is SPF only if its FIRST term is exactly v=spf1 (word boundary:
// v=spf10 is not SPF). Shared with the owner-seat auto-fix so scanner and fixer cannot disagree.
export const isSpfRecord = (r: string) => /^v=spf1(\s|$)/i.test(r.trim());
const SPF_KNOWN = /^[+\-~?]?(all|include:\S+|a(:\S+)?(\/\d+)?(\/\/\d+)?|mx(:\S+)?(\/\d+)?(\/\/\d+)?|ip4:\S+|ip6:\S+|exists:\S+|ptr(:\S+)?)$|^(redirect|exp)=\S+$/i;
export interface SpfInfo { terms: string[]; allTerm: string | undefined; redirect: boolean; lookups: number; ptr: boolean; unknown: string[] }
export function spfInfo(rec: string): SpfInfo {
  const terms = rec.trim().split(/\s+/).slice(1);
  let lookups = 0; let ptr = false; let redirect = false; const unknown: string[] = [];
  for (const t of terms) {
    const l = t.toLowerCase();
    if (!SPF_KNOWN.test(t)) { unknown.push(t); continue; }
    const m = l.replace(/^[+\-~?]/, "");
    if (m.startsWith("redirect=")) { redirect = true; lookups++; }
    else if (m.startsWith("include:") || m.startsWith("exists:") || m === "a" || m.startsWith("a:") || m.startsWith("a/") || m === "mx" || m.startsWith("mx:") || m.startsWith("mx/")) lookups++;
    else if (m === "ptr" || m.startsWith("ptr:")) { ptr = true; lookups++; }
  }
  // First `all` mechanism wins (RFC 7208 4.6.2); a bare `all` means +all.
  const allTerm = terms.map((t) => t.toLowerCase()).find((t) => t.replace(/^[+\-~?]+/, "") === "all");
  return { terms, allTerm, redirect, lookups, ptr, unknown };
}
export const SPF_LOOKUP_LIMIT = 10;
async function spf(domain: string, f: DohFetch): Promise<Finding> {
  const recs = (await txt(domain, f)).filter(isSpfRecord);
  if (!recs.length) return F("SPF", "FAIL", "No SPF record: anyone can forge email from this domain.", "Publish an SPF TXT record listing your mail senders, ending in -all (hard fail).");
  if (recs.length > 1) return F("SPF", "FAIL", `Multiple SPF records (${recs.length}): receivers ignore SPF entirely, so the domain is spoofable despite having SPF.`, "Publish exactly ONE SPF TXT record: merge every sender into a single v=spf1 record ending in -all.");
  const s = recs[0];
  const i = spfInfo(s);
  const a = i.allTerm;
  if (i.unknown.length) return F("SPF", "FAIL", `SPF has terms receivers cannot read (${i.unknown.join(" ")}): a permanent error, so SPF is ignored: ${s}`, "Remove or correct the unknown terms so the record uses only valid SPF mechanisms.");
  // F38: the count is the NESTED walk (includes of includes), not just this record's own terms. Only walked when
  // there is something to nest into. UNKNOWN (failed lookup, depth or call cap) falls back to the direct count.
  let lookups = i.lookups;
  if (i.terms.some((t) => /^[+\-~?]?(include:|redirect=)/i.test(t))) {
    const live = dohSpfResolver(f); let rootSeen = false; // the root TXT was already read above: do not fetch it twice
    const n = await spfNestedLookups(domain, (type, name) => (!rootSeen && type === "TXT" && name === domain ? (rootSeen = true, Promise.resolve({ status: "ok" as const, records: recs })) : live(type, name)));
    if (n.state === "OVER_LIMIT" && n.cycle) return F("SPF", "FAIL", `SPF includes loop back on themselves (${n.lookups} DNS lookups counted before the loop): receivers never finish evaluating it and treat it as a permanent error: ${s}`, "Remove the circular include so every include chain ends in plain ip4/ip6 ranges, and keep the total at 10 lookups or fewer.");
    if (n.state === "OVER_LIMIT") lookups = Math.max(lookups, n.lookups);
  }
  if (lookups > SPF_LOOKUP_LIMIT) return F("SPF", "FAIL", `SPF needs ${lookups} DNS lookups, over the limit of ${SPF_LOOKUP_LIMIT}: receivers treat it as a permanent error and ignore it: ${s}`, "Cut the record to 10 lookups or fewer: remove unused senders or replace includes with ip4/ip6 ranges.");
  if (i.redirect && a) return F("SPF", "FAIL", `SPF has both redirect= and ${a}: the redirect is ignored, so senders behind it are not authorised: ${s}`, "Remove the all mechanism so the redirect is used, or remove the redirect= and list the senders directly.");
  if (a === "+all" || a === "all") return F("SPF", "FAIL", `SPF authorises ALL senders (${a}): worse than no SPF: ${s}`, "Change the SPF record's ending to -all (hard fail). Never use +all.");
  if (i.ptr) return F("SPF", "WARN", `SPF uses the ptr mechanism, which is slow, unreliable and deprecated (RFC 7208): ${s}`, "Replace ptr with explicit ip4/ip6 ranges or includes.");
  if (a === "-all") return F("SPF", "PASS", `Strong SPF (hard fail): ${s}`);
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
  modelCalls: 0; // asserted by the tests, a literal type on purpose
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
  // All checks (and all 12 DKIM selectors) run in parallel: one round of lookups, not 17 in a row.
  const findings = await Promise.all(CHECKS.map(async ([name, fn]) => {
    try { return await fn(domain, f); }
    catch (e) { return F(name, "UNKNOWN", "Could not read this record just now. This is not a pass or a fail.", ""); }
  }));
  const g = grade(findings);
  return { domain, findings, ...g, elapsedMs: now() - t0, modelCalls: 0 };
}
