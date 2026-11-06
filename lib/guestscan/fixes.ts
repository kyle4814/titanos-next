// GET THIS FIXED: deterministic fix plans, code only, zero model calls.
// Minutes are MODELLED estimates (Titanos, 2026-11-06): the time a non-specialist
// needs for a first attempt, found by reading the vendor docs, against the time
// to apply a ready-made plan. They are labelled as estimates wherever shown.
import type { Finding, ScanResult } from "./scan.ts";

export interface FixStep { check: string; severity: "FAIL" | "WARN"; title: string; record?: { host: string; type: "TXT"; value: string }; steps: string[]; verify: string; minutesByHand: number; minutesWithPlan: number }

const BY_HAND: Record<string, [number, number]> = { SPF: [45, 5], DMARC: [60, 5], DKIM: [60, 15], DNSSEC: [30, 10], MX: [20, 5], "MTA-STS": [90, 30] };

export function fixFor(f: Finding, domain: string): FixStep | null {
  if (f.status !== "FAIL" && f.status !== "WARN") return null;
  const [byHand, withPlan] = BY_HAND[f.check] ?? [30, 10];
  const base = { check: f.check, severity: f.status as "FAIL" | "WARN", minutesByHand: byHand, minutesWithPlan: withPlan };
  switch (f.check) {
    case "SPF":
      return { ...base, title: "Lock down who can send as your domain (SPF)", record: { host: domain, type: "TXT", value: "v=spf1 include:<your mail provider> -all" },
        steps: ["Find your mail provider's SPF include (Google: include:_spf.google.com, Microsoft 365: include:spf.protection.outlook.com).", "In your DNS host, keep ONE TXT record on the root of your domain that starts v=spf1 and delete any others.", "End it with -all, then save."], verify: `dig +short TXT ${domain}` };
    case "DMARC":
      return { ...base, title: "Tell receivers what to do with forged mail (DMARC)", record: { host: `_dmarc.${domain}`, type: "TXT", value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}; pct=100` },
        steps: ["Add the TXT record below at _dmarc to start watching (p=none).", "After about two weeks of clean reports, change p=none to p=quarantine, then p=reject.", "Keep pct=100 so the policy covers all mail."], verify: `dig +short TXT _dmarc.${domain}` };
    case "DKIM":
      return { ...base, title: "Sign your outgoing mail (DKIM)", steps: ["In your mail provider's admin console, turn on DKIM signing for this domain.", "The console shows a TXT record to publish at <selector>._domainkey. Add it at your DNS host.", "Go back to the console and press verify."], verify: `dig +short TXT <selector>._domainkey.${domain}` };
    case "DNSSEC":
      return { ...base, title: "Sign your DNS answers (DNSSEC)", steps: ["At your DNS host, switch DNSSEC on (it gives you a DS record).", "Add that DS record at your domain registrar.", "Wait for it to propagate, then re-check."], verify: `dig +short DS ${domain}` };
    case "MX":
      return { ...base, title: "Point your domain's mail at a mail provider (MX)", steps: ["Only needed if this domain should receive email.", "Copy the MX records from your mail provider's setup page into your DNS host."], verify: `dig +short MX ${domain}` };
    case "MTA-STS":
      return { ...base, title: "Require encrypted delivery to your domain (MTA-STS)", record: { host: `_mta-sts.${domain}`, type: "TXT", value: "v=STSv1; id=20261106000000Z" },
        steps: ["Host a small policy file at https://mta-sts." + domain + "/.well-known/mta-sts.txt.", "Publish the TXT record below.", "Optional best practice: lower priority than SPF, DMARC and DKIM."], verify: `dig +short TXT _mta-sts.${domain}` };
    default:
      return null;
  }
}

export interface FixPlan { domain: string; steps: FixStep[]; minutesByHand: number; minutesWithPlan: number; minutesHandedBack: number; hoursHandedBack: number }

// Critical (FAIL first, then WARN, spoofing-critical before the rest).
export function buildPlan(r: Pick<ScanResult, "domain" | "findings">): FixPlan {
  const rank = (s: FixStep) => (s.severity === "FAIL" ? 0 : 2) + (["SPF", "DMARC", "DKIM"].includes(s.check) ? 0 : 1);
  const steps = r.findings.map((f) => fixFor(f, r.domain)).filter((x): x is FixStep => !!x).sort((a, b) => rank(a) - rank(b));
  const byHand = steps.reduce((n, s) => n + s.minutesByHand, 0);
  const plan = steps.reduce((n, s) => n + s.minutesWithPlan, 0);
  return { domain: r.domain, steps, minutesByHand: byHand, minutesWithPlan: plan, minutesHandedBack: byHand - plan, hoursHandedBack: Math.round(((byHand - plan) / 60) * 10) / 10 };
}

// The GET THIS FIXED button: an event for the 3% kill test. Counting needs live traffic (PENDING LIVE).
export interface HandRaise { event: "scan_get_fixed"; domain: string; grade: string; failing: string[] }
export function handRaise(r: ScanResult): HandRaise {
  return { event: "scan_get_fixed", domain: r.domain, grade: r.grade, failing: r.findings.filter((f) => f.status === "FAIL" || f.status === "WARN").map((f) => f.check) };
}
