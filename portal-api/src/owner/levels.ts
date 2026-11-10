// The Business Level, L1 to L10. Pure function of PROVEN state: a level is never granted by a claim,
// only by the latest scan. Level N needs every level below it (cumulative), so a regression anywhere
// drops the level and the badge with it. Zero model calls.
import type { Finding, ScanResult } from "../../../lib/guestscan/scan.ts";

export interface LevelCtx { domainVerified: boolean; monitorActive: boolean; cleanDays: number /* days since last regression with all six PASS, 0 if not all PASS */ }
export interface LevelDef { level: number; name: string; test: (r: ScanResult, c: LevelCtx) => boolean; why: string }

const st = (r: ScanResult, k: string) => r.findings.find((f) => f.check === k)?.status;
const dmarcP = (r: ScanResult) => (/p=(\w+)/i.exec(r.findings.find((f) => f.check === "DMARC")?.detail ?? "")?.[1] ?? "").toLowerCase();
const known = (r: ScanResult) => r.findings.some((f) => f.status !== "UNKNOWN");

export const LEVELS: LevelDef[] = [
  { level: 1, name: "On the map", why: "domain ownership proven by DNS TXT", test: (_r, c) => c.domainVerified },
  { level: 2, name: "Seen", why: "a scan of the domain could be read", test: (r) => known(r) },
  { level: 3, name: "Not forgeable by anyone", why: "SPF is a single record that is not +all", test: (r) => st(r, "SPF") === "PASS" || st(r, "SPF") === "WARN" },
  { level: 4, name: "Watching", why: "a single DMARC record exists", test: (r) => st(r, "DMARC") === "PASS" || st(r, "DMARC") === "WARN" },
  { level: 5, name: "Signed and locked", why: "SPF hard fail and DKIM signing found", test: (r) => st(r, "SPF") === "PASS" && st(r, "DKIM") === "PASS" },
  { level: 6, name: "Forged mail blocked", why: "DMARC quarantine or reject", test: (r) => ["quarantine", "reject"].includes(dmarcP(r)) && st(r, "DMARC") !== "FAIL" },
  { level: 7, name: "Strict", why: "DMARC reject at 100 percent", test: (r) => st(r, "DMARC") === "PASS" },
  { level: 8, name: "Hardened", why: "DNSSEC on and MX present", test: (r) => st(r, "DNSSEC") === "PASS" && st(r, "MX") === "PASS" },
  { level: 9, name: "Encrypted in transit", why: "MTA-STS present (all six controls PASS)", test: (r) => r.findings.every((f) => f.status === "PASS") },
  { level: 10, name: "Stays fixed", why: "all six PASS, monitor active, clean for 30 days", test: (r, c) => c.monitorActive && c.cleanDays >= 30 && r.findings.every((f) => f.status === "PASS") },
];
export interface LevelResult { level: number; name: string; next?: { level: number; name: string; why: string }; reasons: string[] }
export function computeLevel(r: ScanResult | undefined, c: LevelCtx): LevelResult {
  if (!r) return { level: c.domainVerified ? 1 : 0, name: c.domainVerified ? LEVELS[0].name : "Not started", next: { level: c.domainVerified ? 2 : 1, name: LEVELS[c.domainVerified ? 1 : 0].name, why: LEVELS[c.domainVerified ? 1 : 0].why }, reasons: ["no scan yet"] };
  let lvl = 0;
  for (const d of LEVELS) { if (d.test(r, c)) lvl = d.level; else break; }
  const nx = LEVELS[lvl];
  return { level: lvl, name: lvl ? LEVELS[lvl - 1].name : "Not started", next: nx ? { level: nx.level, name: nx.name, why: nx.why } : undefined, reasons: LEVELS.slice(0, lvl).map((d) => `L${d.level} ${d.why}`) };
}
export const BADGE_MIN_LEVEL = 3; // a badge exists from L3 up; D5 keeps it private/opt-in
