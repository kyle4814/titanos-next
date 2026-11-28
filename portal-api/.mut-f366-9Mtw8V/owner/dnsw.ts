// DNS write seam for auto-fix. DnsWriter is the ONLY way the owner seat changes a zone.
// MemoryZone is the test/local adapter (it also serves reads to the scanner, so a fix is
// proven by the same scanner that found the fault). A real provider adapter (Cloudflare,
// Route 53...) needs the owner's DNS credentials: GATE2, see the receipt CARD NEEDED.
import type { DohFetch } from "../../../lib/guestscan/scan.ts";
import { fakeDoh, type World } from "../../../lib/guestscan/fixtures.ts";

export interface DnsWriter {
  getTxt(name: string): Promise<string[]>;
  setTxt(name: string, values: string[]): Promise<void>; // replaces the whole TXT set at name
  getMx(name: string): Promise<string[]>;
  setMx(name: string, values: string[]): Promise<void>;
  setDs(name: string, present: boolean): Promise<void>;
}
export class MemoryZone implements DnsWriter {
  world: World;
  writes: { op: string; name: string }[] = [];
  constructor(w: World = {}) { this.world = { txt: { ...(w.txt ?? {}) }, mx: w.mx ? [...w.mx] : undefined, ds: w.ds, servfail: w.servfail }; }
  async getTxt(n: string) { return [...(this.world.txt?.[n] ?? [])]; }
  async setTxt(n: string, v: string[]) { this.writes.push({ op: "txt", name: n }); this.world.txt = { ...(this.world.txt ?? {}) }; if (v.length) this.world.txt[n] = [...v]; else delete this.world.txt[n]; }
  async getMx(_n: string) { return [...(this.world.mx ?? [])]; }
  async setMx(_n: string, v: string[]) { this.writes.push({ op: "mx", name: _n }); this.world.mx = [...v]; }
  async setDs(_n: string, p: boolean) { this.writes.push({ op: "ds", name: _n }); this.world.ds = p; }
  get doh(): DohFetch { return (name, type) => fakeDoh(this.world).fetch(name, type); }
}
