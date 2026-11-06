import { planFor, applyEdits } from "../../src/owner/autofix.ts";
import { MemoryZone } from "../../src/owner/dnsw.ts";
import { healthy } from "../../test/owner_harness.ts";
import { loadOrInit, scanNow, autoFix, MemoryOwnerStore } from "../../src/owner/engine.ts";
const D = "acme.example.com.au";
const cases: Record<string, string[]> = {
  "redirect only (no all)": ["v=spf1 redirect=_spf.bigmail.example.com"],
  "redirect + ~all?": ["v=spf1 redirect=_spf.bigmail.example.com ~all"],
  "exp modifier": ["v=spf1 include:_spf.google.com exp=explain.example.com ~all"],
  "ip6 + a + mx": ["v=spf1 a mx ip4:203.0.113.0/24 ip6:2001:db8::/32 ?all"],
  "uppercase": ["V=SPF1 INCLUDE:_spf.google.com ~ALL"],
  "11 lookups after merge": ["v=spf1 include:a1.example.com include:a2.example.com include:a3.example.com include:a4.example.com include:a5.example.com ~all", "v=spf1 include:b1.example.com include:b2.example.com include:b3.example.com include:b4.example.com include:b5.example.com include:b6.example.com -all"],
};
for (const [name, spf] of Object.entries(cases)) {
  const w = healthy(D); w.txt![D] = spf; const z = new MemoryZone(w);
  const c: any = { store: new MemoryOwnerStore(), doh: () => z.doh, zones: { zoneFor: () => z }, now: () => Date.UTC(2026, 10, 6) };
  const s = await loadOrInit(c, "dom1", D, "acc1", true); await scanNow(c, s, "t");
  const f = s.findings["SPF"];
  const plan = await planFor("SPF", D, z);
  let result = "(no autofix)";
  if (plan.auto) { const r: any = await autoFix(c, s, "SPF"); result = `${r.ok ? r.result : r.reason} -> zone now: ${JSON.stringify(z.world.txt![D])}`; }
  console.log(`${name}\n   before=${JSON.stringify(spf)} finding=${f?.state}\n   auto=${plan.auto} ${plan.summary}\n   ${result}`);
}
