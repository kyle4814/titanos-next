// F173: shared synthetic generator + rig for the F95 undo property suite and the F173 store differential. SYNTHETIC data only.
import { MemoryZone } from "../src/owner/dnsw.ts";
import { MemoryOwnerStore, loadOrInit, type Ctx } from "../src/owner/engine.ts";
import { T0 } from "./owner_harness.ts";
import { D1OwnerStore } from "../src/owner/d1ownerstore.ts";
import { FakeD1 } from "./owner_fake_d1.ts";
import type { World } from "../../lib/guestscan/fixtures.ts";

// ---------- seeded PRNG + synthetic zone generator ----------
export function prng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export type Rng = () => number;
export const pick = <T,>(r: Rng, a: T[]): T => a[Math.floor(r() * a.length)];
export const chance = (r: Rng, p: number) => r() < p;
export const int = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
export const NINC = 16;
export const incName = (k: number) => `inc${k}.example`;

export function spfRecord(r: Rng, o: { redirect?: boolean; minIncludes?: number; maxIncludes?: number; allTerm?: string | null } = {}): string {
  const terms: string[] = [];
  const nInc = int(r, o.minIncludes ?? 0, o.maxIncludes ?? 6);
  const used = new Set<number>();
  while (used.size < Math.min(nInc, NINC)) used.add(int(r, 0, NINC - 1));
  for (const k of used) terms.push(`include:${incName(k)}`);
  if (chance(r, 0.3)) terms.push("a"); if (chance(r, 0.3)) terms.push("mx");
  if (chance(r, 0.5)) terms.push(`ip4:192.0.2.${int(r, 0, 250)}/24`); if (chance(r, 0.2)) terms.push("ip6:2001:db8::/32");
  if (chance(r, 0.05)) terms.push("ptr"); if (chance(r, 0.04)) terms.push("foo:bar");
  if (o.redirect) terms.push(`redirect=${incName(int(r, 0, NINC - 1))}`);
  const all = o.allTerm !== undefined ? o.allTerm : pick(r, ["-all", "-all", "~all", "?all", "all", "+all", null]);
  if (all) terms.push(all);
  return ["v=spf1", ...terms].join(" ");
}
export function includeTargets(r: Rng): Record<string, string[]> {
  const t: Record<string, string[]> = {};
  for (let k = 0; k < NINC; k++) {
    const n = chance(r, 0.35) ? int(r, 1, 3) : 0; const terms = ["v=spf1", `ip4:198.51.100.${k}/32`];
    for (let j = 0; j < n; j++) terms.push(`include:${incName((k + 1 + j) % NINC)}`); // nested, may loop: the scanner must cope
    terms.push("-all"); t[incName(k)] = [terms.join(" ")];
  }
  return t;
}
export function genWorld(r: Rng, domain: string): World {
  const txt: Record<string, string[]> = { ...includeTargets(r) };
  const apex: string[] = [];
  const nSpf = pick(r, [0, 1, 1, 1, 1, 1, 1, 2, 2, 3]);
  for (let i = 0; i < nSpf; i++) apex.push(spfRecord(r));
  const other = ["google-site-verification=abc123", "MS=ms99887766", "atlassian-domain-verification=zzz"];
  for (const o of other) if (chance(r, 0.4)) apex.push(o);
  for (let i = apex.length - 1; i > 0; i--) { const j = int(r, 0, i); [apex[i], apex[j]] = [apex[j], apex[i]]; } // record order is part of the "exact" zone
  if (apex.length) txt[domain] = apex;
  const dm: string[] = []; const nD = pick(r, [0, 1, 1, 1, 1, 2, 2]);
  for (let i = 0; i < nD; i++) { const p = pick(r, ["none", "quarantine", "reject", "reject", ""]); const pct = pick(r, ["", "; pct=100", "; pct=50", "; pct=0"]); dm.push(`v=DMARC1;${p ? ` p=${p};` : ""} rua=mailto:d${i}@${domain}${pct}`); }
  if (chance(r, 0.06)) dm.push("some-stray-text-record");
  if (dm.length) txt[`_dmarc.${domain}`] = dm;
  if (chance(r, 0.6)) txt[`google._domainkey.${domain}`] = ["v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3"];
  if (chance(r, 0.5)) txt[`_mta-sts.${domain}`] = ["v=STSv1; id=20261106"];
  if (chance(r, 0.3)) txt[`www.${domain}`] = ["unrelated record the fixer must never touch"];
  const w: World = { txt, mx: chance(r, 0.8) ? ["10 mx1.example.", "20 mx2.example."] : [], ds: chance(r, 0.5) };
  if (chance(r, 0.04)) w.servfail = [`${domain}/TXT`];
  return w;
}

// ---------- rig: a recording zone, so ORDER of writes and re-scan reads can be asserted ----------
export class RecZone extends MemoryZone {
  log: ("w" | "r")[] = [];
  async setTxt(n: string, v: string[]) { this.log.push("w"); return super.setTxt(n, v); }
  async setMx(n: string, v: string[]) { this.log.push("w"); return super.setMx(n, v); }
  async setDs(n: string, p: boolean) { this.log.push("w"); return super.setDs(n, p); }
  get doh() { const d = super.doh; return ((n: string, t: string) => { this.log.push("r"); return d(n, t); }) as typeof d; }
}
// F173: the SAME properties run against either store. UNDO_STORE=d1 swaps in D1OwnerStore over FakeD1 (real SQLite, the real migrations,
// foreign keys ON). The default (memory) is unchanged, so the F95 suite and its mutation runner behave exactly as before.
export const STORE_KIND: "memory" | "d1" = process.env.UNDO_STORE === "d1" ? "d1" : "memory";
export const LABEL = STORE_KIND === "d1" ? "[D1OwnerStore]" : "[MemoryOwnerStore]";
export function makeStore(kind: "memory" | "d1", domainId: string, domain: string, accountId: string, clock: () => number) {
  if (kind === "memory") return { store: new MemoryOwnerStore(), d1: undefined as FakeD1 | undefined };
  const d1 = new FakeD1();
  d1.db.prepare("INSERT INTO accounts (id, email) VALUES (?, ?)").run(accountId, `${accountId}@example.test`);
  d1.db.prepare("INSERT INTO domains (id, account_id, domain, verify_token) VALUES (?, ?, ?, 't')").run(domainId, accountId, domain);
  return { store: new D1OwnerStore(d1, clock), d1 };
}
export function rigOf(world: World, domain: string, kind: "memory" | "d1" = STORE_KIND) {
  const clock = { t: T0 };
  const zone = new RecZone(world);
  const now = () => (clock.t += 1000);
  const { store, d1 } = makeStore(kind, "dom_1", domain, "acc_1", () => clock.t);
  const c: Ctx = { store, doh: () => zone.doh, zones: { zoneFor: (d) => (d === domain ? zone : undefined) }, now };
  return { zone, c, d1, domain, clock, open: () => loadOrInit(c, "dom_1", domain, "acc_1", true), snap: () => structuredClone(zone.world) };
}
export const writesSince = (z: RecZone, mark: number) => z.log.slice(mark).filter((x) => x === "w").length;
export const rescanAfterLastWrite = (z: RecZone) => { const i = z.log.lastIndexOf("w"); return i >= 0 && z.log.slice(i + 1).includes("r"); };
