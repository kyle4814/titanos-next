// x3_escape_review shared helpers. Probes only: no product code is changed, nothing here touches the network.
import { handle } from "../../src/index.ts";
import { rig as marketRig } from "../../test/market_harness.ts";
import { MemoryOwnerStore } from "../../src/owner/engine.ts";

// A line per open finding, greppable from the test output: X3-FINDING <id> <sev> <summary> | <evidence>
export function finding(id: string, sev: "P0" | "P1" | "P2" | "P3", summary: string, evidence: string) {
  console.log(`X3-FINDING ${id} ${sev} ${summary} | ${evidence}`);
}
export function blocked(id: string, summary: string) { console.log(`X3-BLOCKED ${id} ${summary}`); }

// Market rig plus the owner seat wired on the same zones, so every seat can be attacked from one world.
export function fullRig() {
  const r = marketRig();
  r.h.deps.owner = { store: new MemoryOwnerStore(), doh: (dom: string) => { const z = r.zones.get(dom); if (!z) throw new Error("no zone " + dom); return z.doh; }, zones: { zoneFor: (dom: string) => r.zones.get(dom) } };
  return r;
}
// Raw request with an exact body string (the harness JSON-encodes bodies, which hides prototype-named keys).
export const raw = (h: { deps: any }, method: string, path: string, body: string | undefined, headers: Record<string, string> = {}) =>
  handle(new Request("https://api.test" + path, { method, headers, body }), { TITANOS_SITE_ORIGIN: "https://titanos.tech" }, h.deps);
