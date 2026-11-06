// PLANTED FIXTURES: SYNTHETIC DNS worlds with known faults. Not real domains (.example reserved names).
// Each carries the verdict a correct scanner must give. The grader scores 100% or the gate fails.
import type { DohFetch, DohResponse, Status } from "./scan.ts";

export interface World { txt?: Record<string, string[]>; mx?: string[]; ds?: boolean; servfail?: string[] /* names that SERVFAIL */; nxdomain?: boolean }
export interface Fixture { id: string; domain: string; world: World; expect: Partial<Record<string, Status>>; grade?: string }

const GOOD_SPF = "v=spf1 include:_spf.google.com -all";
const GOOD_DMARC = "v=DMARC1; p=reject; rua=mailto:d@good.example";
export const FIXTURES: Fixture[] = [
  { id: "perfect", domain: "good.example", world: { txt: { "good.example": [GOOD_SPF], "_dmarc.good.example": [GOOD_DMARC], "google._domainkey.good.example": ["v=DKIM1; k=rsa; p=MIGfMA0GCS"], "_mta-sts.good.example": ["v=STSv1; id=1"] }, mx: ["10 mx.good.example."], ds: true },
    expect: { SPF: "PASS", DMARC: "PASS", DKIM: "PASS", DNSSEC: "PASS", MX: "PASS", "MTA-STS": "PASS" }, grade: "A" },
  { id: "nothing-published", domain: "bare.example", world: {}, expect: { SPF: "FAIL", DMARC: "FAIL", DKIM: "WARN", DNSSEC: "WARN", MX: "WARN", "MTA-STS": "WARN" }, grade: "F" },
  { id: "spf-plus-all", domain: "plusall.example", world: { txt: { "plusall.example": ["v=spf1 +all"] } }, expect: { SPF: "FAIL" } },
  { id: "spf-bare-all", domain: "bareall.example", world: { txt: { "bareall.example": ["v=spf1 all"] } }, expect: { SPF: "FAIL" } },
  { id: "spf-plus-all-then-minus", domain: "trap1.example", world: { txt: { "trap1.example": ["v=spf1 +all -all"] } }, expect: { SPF: "FAIL" } },
  { id: "spf-softfail", domain: "soft.example", world: { txt: { "soft.example": ["v=spf1 include:x.example ~all"] } }, expect: { SPF: "WARN" } },
  { id: "spf-lookalike-all-token", domain: "lookalike.example", world: { txt: { "lookalike.example": ["v=spf1 include:fall -all"] } }, expect: { SPF: "PASS" } },
  { id: "spf-two-records", domain: "dupspf.example", world: { txt: { "dupspf.example": [GOOD_SPF, "v=spf1 -all"] } }, expect: { SPF: "FAIL" } },
  { id: "spf-no-all", domain: "noall.example", world: { txt: { "noall.example": ["v=spf1 include:x.example"] } }, expect: { SPF: "WARN" } },
  { id: "dmarc-none", domain: "dnone.example", world: { txt: { "_dmarc.dnone.example": ["v=DMARC1; p=none"] } }, expect: { DMARC: "WARN" } },
  { id: "dmarc-quarantine", domain: "dq.example", world: { txt: { "_dmarc.dq.example": ["v=DMARC1; p=quarantine"] } }, expect: { DMARC: "WARN" } },
  { id: "dmarc-reject-pct0", domain: "pct0.example", world: { txt: { "_dmarc.pct0.example": ["v=DMARC1; p=reject; pct=0"] } }, expect: { DMARC: "WARN" } },
  { id: "dmarc-subdomain-trap", domain: "sp.example", world: { txt: { "_dmarc.sp.example": ["v=DMARC1; p=none; sp=reject"] } }, expect: { DMARC: "WARN" } },
  { id: "dmarc-two-records", domain: "dupdmarc.example", world: { txt: { "_dmarc.dupdmarc.example": [GOOD_DMARC, "v=DMARC1; p=none"] } }, expect: { DMARC: "FAIL" } },
  { id: "dkim-revoked-key", domain: "revoked.example", world: { txt: { "default._domainkey.revoked.example": ["v=DKIM1; p="] } }, expect: { DKIM: "WARN" } },
  { id: "dkim-selector2", domain: "sel.example", world: { txt: { "selector2._domainkey.sel.example": ["v=DKIM1; p=ABCDEF"] } }, expect: { DKIM: "PASS" } },
  { id: "servfail-is-unknown", domain: "flaky.example", world: { servfail: ["flaky.example/TXT", "_dmarc.flaky.example/TXT"] }, expect: { SPF: "UNKNOWN", DMARC: "UNKNOWN" } },
  { id: "all-unreadable", domain: "dead.example", world: { servfail: ["*"] }, expect: { SPF: "UNKNOWN", DMARC: "UNKNOWN", DKIM: "UNKNOWN" }, grade: "?" },
  { id: "dnssec-on", domain: "signed.example", world: { ds: true }, expect: { DNSSEC: "PASS" } },
  { id: "mx-multi", domain: "mail.example", world: { mx: ["10 a.mail.example.", "20 b.mail.example."] }, expect: { MX: "PASS" } },
  { id: "mta-sts", domain: "sts.example", world: { txt: { "_mta-sts.sts.example": ["v=STSv1; id=7"] } }, expect: { "MTA-STS": "PASS" } },
];

export interface Fake { fetch: DohFetch; calls: { name: string; type: string }[] }
export function fakeDoh(w: World, delayMs = 0, sleep?: (ms: number) => Promise<void>): Fake {
  const calls: Fake["calls"] = [];
  const f: DohFetch = async (name, type) => {
    calls.push({ name, type });
    if (delayMs && sleep) await sleep(delayMs);
    if (w.servfail?.includes("*") || w.servfail?.includes(`${name}/${type}`)) return { Status: 2 };
    const ans = (data: string): DohResponse => ({ Status: 0, Answer: [{ name, type: 16, data }] });
    if (type === "TXT") { const v = w.txt?.[name]; return v?.length ? { Status: 0, Answer: v.map((x) => ({ name, type: 16, data: `"${x}"` })) } : { Status: 0 }; }
    if (type === "MX") return w.mx?.length ? { Status: 0, Answer: w.mx.map((x) => ({ name, type: 15, data: x })) } : { Status: 0 };
    if (type === "DS") return w.ds ? ans("12345 13 2 ABCD") : { Status: 0 };
    return { Status: 0 };
  };
  return { fetch: f, calls };
}
