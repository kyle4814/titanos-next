// 20 planted faults. Each plants a fault into an otherwise healthy zone, the owner's real-world fix is
// written as a zone edit (what a person does at their DNS host), and `auto` says whether the auto-fixer
// may do it alone. Synthetic domains only (.example).
import type { MemoryZone } from "../src/owner/dnsw.ts";
export interface Fault { id: string; check: string; auto: boolean; plant: (z: MemoryZone, d: string) => void; ownerFix: (z: MemoryZone, d: string) => Promise<void>; autoThenOwner?: boolean }
const G = "include:_spf.google.com";
const spf = (v: string[]) => (z: MemoryZone, d: string) => { z.world.txt![d] = v; };
const dm = (v: string[]) => (z: MemoryZone, d: string) => { z.world.txt![`_dmarc.${d}`] = v; };
const goodSpf = async (z: MemoryZone, d: string) => { z.world.txt![d] = [`v=spf1 ${G} -all`]; };
const goodDmarc = async (z: MemoryZone, d: string) => { z.world.txt![`_dmarc.${d}`] = [`v=DMARC1; p=reject; rua=mailto:dmarc@${d}; pct=100`]; };
export const FAULTS: Fault[] = [
  { id: "01 spf missing", check: "SPF", auto: false, plant: (z, d) => { delete z.world.txt![d]; }, ownerFix: goodSpf },
  { id: "02 spf +all", check: "SPF", auto: true, plant: spf([`v=spf1 ${G} +all`]), ownerFix: goodSpf },
  { id: "03 spf bare all", check: "SPF", auto: true, plant: spf([`v=spf1 ${G} all`]), ownerFix: goodSpf },
  { id: "04 spf softfail", check: "SPF", auto: true, plant: spf([`v=spf1 ${G} ~all`]), ownerFix: goodSpf },
  { id: "05 spf neutral", check: "SPF", auto: true, plant: spf([`v=spf1 ${G} ?all`]), ownerFix: goodSpf },
  { id: "06 spf no all", check: "SPF", auto: true, plant: spf([`v=spf1 ${G}`]), ownerFix: goodSpf },
  { id: "07 spf two records", check: "SPF", auto: true, plant: spf([`v=spf1 ${G} -all`, "v=spf1 include:mailchimp.example -all"]), ownerFix: goodSpf },
  { id: "08 spf +all then -all trap", check: "SPF", auto: true, plant: spf([`v=spf1 ${G} +all -all`]), ownerFix: goodSpf },
  { id: "09 dmarc missing", check: "DMARC", auto: true, autoThenOwner: true, plant: (z, d) => { delete z.world.txt![`_dmarc.${d}`]; }, ownerFix: goodDmarc },
  { id: "10 dmarc p=none", check: "DMARC", auto: false, plant: dm(["v=DMARC1; p=none; rua=mailto:d@x.example"]), ownerFix: goodDmarc },
  { id: "11 dmarc quarantine", check: "DMARC", auto: false, plant: dm(["v=DMARC1; p=quarantine; rua=mailto:d@x.example"]), ownerFix: goodDmarc },
  { id: "12 dmarc reject pct=50", check: "DMARC", auto: true, plant: dm(["v=DMARC1; p=reject; rua=mailto:d@x.example; pct=50"]), ownerFix: goodDmarc },
  { id: "13 dmarc two records", check: "DMARC", auto: true, plant: dm(["v=DMARC1; p=reject; rua=mailto:d@x.example; pct=100", "v=DMARC1; p=none"]), ownerFix: goodDmarc },
  { id: "14 dmarc sp trap", check: "DMARC", auto: false, plant: dm(["v=DMARC1; p=none; sp=reject"]), ownerFix: goodDmarc },
  { id: "15 dkim missing", check: "DKIM", auto: false, plant: (z, d) => { delete z.world.txt![`google._domainkey.${d}`]; }, ownerFix: async (z, d) => { z.world.txt![`google._domainkey.${d}`] = ["v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3"]; } },
  { id: "16 dkim revoked key", check: "DKIM", auto: false, plant: (z, d) => { z.world.txt![`google._domainkey.${d}`] = ["v=DKIM1; p="]; }, ownerFix: async (z, d) => { z.world.txt![`google._domainkey.${d}`] = ["v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3"]; } },
  { id: "17 dnssec off", check: "DNSSEC", auto: false, plant: (z) => { z.world.ds = false; }, ownerFix: async (z) => { z.world.ds = true; } },
  { id: "18 mx missing", check: "MX", auto: false, plant: (z) => { z.world.mx = []; }, ownerFix: async (z) => { z.world.mx = ["10 aspmx.l.google.com."]; } },
  { id: "19 mta-sts missing", check: "MTA-STS", auto: false, plant: (z, d) => { delete z.world.txt![`_mta-sts.${d}`]; }, ownerFix: async (z, d) => { z.world.txt![`_mta-sts.${d}`] = ["v=STSv1; id=20261107"]; } },
  { id: "20 double fault: spf +all and dmarc missing", check: "SPF", auto: true, plant: (z, d) => { z.world.txt![d] = [`v=spf1 ${G} +all`]; delete z.world.txt![`_dmarc.${d}`]; }, ownerFix: async (z, d) => { await goodSpf(z, d); await goodDmarc(z, d); } },
];
