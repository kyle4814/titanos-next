import { MemoryZone } from "../src/owner/dnsw.ts";
import { MemoryOwnerStore, loadOrInit, scanNow, setMonitor, type Ctx, type DomainState } from "../src/owner/engine.ts";
import type { World } from "../../lib/guestscan/fixtures.ts";

export const T0 = Date.UTC(2026, 10, 6, 0, 0, 0);
export const DAY = 86_400_000;
export const healthy = (d: string): World => ({
  txt: { [d]: ["v=spf1 include:_spf.google.com -all"], [`_dmarc.${d}`]: [`v=DMARC1; p=reject; rua=mailto:dmarc@${d}; pct=100`], [`google._domainkey.${d}`]: ["v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3"], [`_mta-sts.${d}`]: ["v=STSv1; id=20261106"] },
  mx: ["10 aspmx.l.google.com."], ds: true,
});
export function rig(domain = "owner.example") {
  const clock = { t: T0 };
  const zone = new MemoryZone(healthy(domain));
  const c: Ctx = { store: new MemoryOwnerStore(), doh: () => zone.doh, zones: { zoneFor: (d) => (d === domain ? zone : undefined) }, now: () => clock.t };
  const open = async (verified = true): Promise<DomainState> => loadOrInit(c, "dom_1", domain, "acc_1", verified);
  const save = (s: DomainState) => c.store.put(s);
  return { clock, zone, c, domain, open, save, scan: async (s: DomainState, cause?: string) => { const r = await scanNow(c, s, cause); await save(s); return r; }, monitorOn: (s: DomainState) => setMonitor(s, true, clock.t) };
}
