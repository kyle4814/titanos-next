// Real estate scan: the C1 scanner/grader (lib/guestscan) behind the ScanProvider seam.
// PASSIVE PUBLIC DNS ONLY: the sole I/O is the injected DohFetch resolver (public DNS-over-HTTPS TXT/MX/DS reads).
// Nothing on the owner's servers is touched. A failed or slow read is UNKNOWN, never a guessed grade.
// Callers (estate()) only pass VERIFIED assets here; the verified-only gate lives in service.estate.
import { runScan, dohFetch, CRITICAL, type DohFetch, type Finding } from "../../../lib/guestscan/scan.ts";
import type { Assessment, ScanFinding, ScanProvider } from "./types.ts";

export interface DnsScanOpts {
  resolver: DohFetch;
  /** Honest label shown to users, e.g. "cloudflare-dns.com (DNS-over-HTTPS, passive public records)". */
  resolverSource: string;
  now?: () => number;
  /** Per-asset wall-clock budget for the whole scan. Default 8000 ms. */
  timeoutMs?: number;
  /** Per-estate cap on domains scanned at once. Default 4 (each domain issues ~17 DNS queries). */
  concurrency?: number;
}

// C1 statuses mapped onto the estate severity counters. UNKNOWN checks count nowhere (neither pass nor fail).
export function severityOf(f: Finding): ScanFinding["severity"] | null {
  const crit = CRITICAL.has(f.check);
  if (f.status === "FAIL") return crit ? "critical" : "high";
  if (f.status === "WARN") return crit ? "medium" : "low";
  return null;
}
export function toScanFindings(fs: Finding[]): ScanFinding[] {
  const out: ScanFinding[] = [];
  for (const f of fs) { const s = severityOf(f); if (s) out.push({ id: f.check.toLowerCase(), severity: s, title: `${f.check}: ${f.detail}` }); }
  return out;
}

export function dnsScan(o: DnsScanOpts): ScanProvider {
  const now = o.now ?? Date.now, timeoutMs = o.timeoutMs ?? 8000;
  const unknown = (reason: "timeout" | "resolver_failed" | "scan_error"): Assessment => ({ status: "UNKNOWN", reason, scannedAt: now(), resolverSource: o.resolverSource });
  async function assess(domain: string): Promise<Assessment> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const TIMEOUT = Symbol("timeout");
    try {
      const r = await Promise.race([
        runScan(domain, o.resolver, now),
        new Promise<typeof TIMEOUT>((res) => { timer = setTimeout(() => res(TIMEOUT), timeoutMs); }),
      ]);
      if (r === TIMEOUT) return unknown("timeout");
      if (r.grade === "?") return unknown("resolver_failed");        // every critical check unreadable: no grade, ever
      const counts = { critical: 0, high: 0, medium: 0, low: 0 };
      for (const f of r.findings) { const s = severityOf(f); if (s) counts[s]++; }
      return { status: "ASSESSED", grade: r.grade, score: r.score, counts, scannedAt: now(), resolverSource: o.resolverSource, unreadableChecks: r.findings.filter((f) => f.status === "UNKNOWN").length };
    } catch { return unknown("scan_error"); }                          // includes invalid_domain
    finally { if (timer) clearTimeout(timer); }
  }
  return {
    source: `LIVE passive public DNS via ${o.resolverSource} (C1 scanner and grader)`,
    concurrency: o.concurrency ?? 4,
    assess,
    async scan(domain) {
      const r = await runScan(domain, o.resolver, now);
      if (r.grade === "?") throw new Error("unknown_resolver_failed");
      return toScanFindings(r.findings);
    },
  };
}

// The production resolver: public DoH only. Constructing it makes no request; tests never call it.
export const publicDohResolver = (timeoutMs = 6000): DohFetch => dohFetch("cloudflare-dns.com", timeoutMs);
