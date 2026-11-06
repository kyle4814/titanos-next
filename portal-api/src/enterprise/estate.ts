import type { ScanFinding, ScanProvider } from "./types.ts";
import { sha256Hex } from "../util.ts";

const WEIGHT = { critical: 25, high: 10, medium: 4, low: 1 } as const;
export function summarise(f: ScanFinding[]) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const x of f) counts[x.severity]++;
  const score = Math.max(0, 100 - counts.critical * WEIGHT.critical - counts.high * WEIGHT.high - counts.medium * WEIGHT.medium - counts.low * WEIGHT.low);
  return { counts, score };
}
export const grade = (score: number) => (score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F");

// SYNTHETIC findings from a hash of the domain, so the estate view is testable end to end. The real adapter is the C1
// scan/grader (passive DNS only), now in estate_dns.ts (dnsScan). This provider stays as the labelled test adapter.
const TITLES: Record<ScanFinding["severity"], string[]> = {
  critical: ["SYNTHETIC: no SPF record", "SYNTHETIC: DMARC absent"],
  high: ["SYNTHETIC: DMARC policy is none"],
  medium: ["SYNTHETIC: MTA-STS missing"],
  low: ["SYNTHETIC: no CAA record"],
};
export const SyntheticScan: ScanProvider = {
  source: "SYNTHETIC fixture data (deterministic from the domain name), not a real scan",
  async scan(domain) {
    const h = await sha256Hex(domain);
    const n = (i: number, mod: number) => parseInt(h.slice(i * 2, i * 2 + 2), 16) % mod;
    const out: ScanFinding[] = [];
    const add = (sev: ScanFinding["severity"], count: number) => { for (let i = 0; i < count; i++) out.push({ id: `${sev}-${i}`, severity: sev, title: TITLES[sev][i % TITLES[sev].length] }); };
    add("critical", n(0, 3) === 0 ? 1 : 0); add("high", n(1, 3) === 0 ? 1 : 0); add("medium", n(2, 3)); add("low", n(3, 3));
    return out;
  },
};
