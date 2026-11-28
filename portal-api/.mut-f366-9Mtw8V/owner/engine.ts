// The owner seat engine (C3). One function, observe(), is the only place a finding changes state, and it is
// driven only by a scan result: nothing is ever "fixed" because someone said so, only because a re-scan says PASS.
// Zero model calls. Pure TypeScript over the C1 scanner.
import { runScan, type DohFetch, type Finding, type ScanResult, type Status } from "../../../lib/guestscan/scan.ts";
import { fixFor } from "../../../lib/guestscan/fixes.ts";
import { computeLevel, BADGE_MIN_LEVEL, type LevelCtx } from "./levels.ts";
import { applyEdits, planFor, revertEdits, type Edit, type Plan } from "./autofix.ts";
import type { DnsWriter } from "./dnsw.ts";

export type ProofState = "OPEN" | "PROVEN_FIXED" | "REGRESSED" | "UNKNOWN" | "MONITORING";
export interface FindingRec {
  check: string; state: ProofState; status: Status; detail: string; fix: string;
  firstSeenAt: number; provenAt?: number; regressedAt?: number; proof?: { scanId: string; at: number; detail: string };
  unreadable?: boolean; episodes: number; notProven: number; minutesByHand: number; minutesWithPlan: number; credited: boolean;
}
export type EventKind = "scan" | "proven_fixed" | "regressed" | "badge_earned" | "badge_lost" | "level_up" | "level_down" | "fix_applied" | "fix_rolled_back" | "fix_undone" | "fix_refused" | "monitor_on" | "monitor_off";
export interface OwnerEvent { at: number; kind: EventKind; check?: string; detail: string; scanId?: string }
export interface FixRec { id: string; check: string; edits: Edit[]; appliedAt: number; status: "applied" | "proven" | "partial" | "rolled_back" | "undone"; note: string }
export interface Badge { level: number; since: number; scanId: string }
export interface DomainState {
  domainId: string; domain: string; accountId: string; scans: number; lastScan?: { id: string; at: number; grade: string; score: number };
  findings: Record<string, FindingRec>; level: number; levelName: string; badge?: Badge; badgeHistory: { level: number; from: number; to?: number; lostBecause?: string }[];
  events: OwnerEvent[]; fixes: FixRec[]; allPassSince?: number; monitor: { active: boolean; nextScanAt?: number; intervalMs: number };
  minutesHandedBack: number; xp: number; domainVerified: boolean;
  rev?: number; // store revision: bumped by every committed write; putCas compares it (F185). Absent = 0 = never stored.
}
export interface OwnerStore {
  get(domainId: string): Promise<DomainState | undefined>; put(s: DomainState): Promise<void>; all(): Promise<DomainState[]>;
  // F185: write s only if the stored revision is still `expectedRev` (0 = no row yet). On success s.rev becomes the new revision and true is
  // returned; false means another writer got in first and nothing was written. Optional so a bare store (a test double) falls back to put.
  putCas?(s: DomainState, expectedRev: number): Promise<boolean>;
}
export class MemoryOwnerStore implements OwnerStore {
  m = new Map<string, DomainState>();
  async get(id: string) { const s = this.m.get(id); return s ? structuredClone(s) : undefined; }
  // put is unconditional (last writer wins) but still advances the revision, so any in-flight putCas holding the old one is refused.
  async put(s: DomainState) { const cur = this.m.get(s.domainId); if (cur && cur.accountId !== s.accountId) throw new Error("owner_state_account_mismatch"); const rev = (cur?.rev ?? 0) + 1; this.m.set(s.domainId, { ...structuredClone(s), rev }); s.rev = rev; }
  async putCas(s: DomainState, expectedRev: number) {
    const cur = this.m.get(s.domainId);
    if (cur && cur.accountId !== s.accountId) throw new Error("owner_state_account_mismatch");
    if ((cur?.rev ?? 0) !== expectedRev) return false;
    const rev = expectedRev + 1; this.m.set(s.domainId, { ...structuredClone(s), rev }); s.rev = rev; return true;
  }
  async all() { return [...this.m.values()].map((s) => structuredClone(s)); }
  // Account-scoped surface (same contract as D1OwnerStore, see src/owner/d1ownerstore.ts).
  async getFor(accountId: string, id: string) { const s = this.m.get(id); return s && s.accountId === accountId ? structuredClone(s) : undefined; }
  async allFor(accountId: string) { return [...this.m.values()].filter((s) => s.accountId === accountId).sort((a, b) => (a.domainId < b.domainId ? -1 : 1)).map((s) => structuredClone(s)); }
  async due(now: number, limit: number) {
    return [...this.m.values()].filter((s) => s.monitor.active && s.monitor.nextScanAt !== undefined && s.monitor.nextScanAt <= now)
      .sort((a, b) => a.monitor.nextScanAt! - b.monitor.nextScanAt! || (a.domainId < b.domainId ? -1 : 1)).slice(0, Math.max(0, Math.floor(limit))).map((s) => structuredClone(s));
  }
  async claimDomain(s: DomainState): Promise<"created" | "exists" | "conflict"> {
    const cur = this.m.get(s.domainId);
    if (!cur) { this.m.set(s.domainId, structuredClone(s)); return "created"; }
    return cur.accountId === s.accountId ? "exists" : "conflict";
  }
  async setMonitorSub(accountId: string, id: string, active: boolean, now: number, intervalMs?: number): Promise<"changed" | "unchanged" | "missing"> {
    const cur = this.m.get(id);
    if (!cur || cur.accountId !== accountId) return "missing";
    if (cur.monitor.active === active) return "unchanged";
    cur.monitor = { active, intervalMs: intervalMs ?? cur.monitor.intervalMs, nextScanAt: active ? now : undefined }; cur.rev = (cur.rev ?? 0) + 1; return "changed";
  }
  async anonymise(accountId: string) { let n = 0; for (const [k, s] of this.m) if (s.accountId === accountId) { this.m.delete(k); n++; } return n; }
}
export interface ZoneProvider { zoneFor(domain: string): DnsWriter | undefined }
export interface Ctx { store: OwnerStore; doh: (domain: string) => DohFetch; zones: ZoneProvider; now: () => number }

export const DAY = 86_400_000;
export const DEFAULT_MONITOR_INTERVAL_MS = DAY;
const MAX_EVENTS = 500;
const CRIT = new Set(["SPF", "DMARC", "DKIM"]);
const sev = (s: Status) => ({ PASS: 0, WARN: 1, UNKNOWN: 1, FAIL: 2 }[s]);

export function newState(domainId: string, domain: string, accountId: string, verified: boolean): DomainState {
  return { domainId, domain, accountId, scans: 0, findings: {}, level: verified ? 1 : 0, levelName: verified ? "On the map" : "Not started", badgeHistory: [], events: [], fixes: [], monitor: { active: false, intervalMs: DEFAULT_MONITOR_INTERVAL_MS }, minutesHandedBack: 0, xp: 0, domainVerified: verified };
}
const push = (s: DomainState, e: OwnerEvent) => { s.events.push(e); if (s.events.length > MAX_EVENTS) s.events.splice(0, s.events.length - MAX_EVENTS); };
export function ctxOf(s: DomainState, now: number): LevelCtx {
  return { domainVerified: s.domainVerified, monitorActive: s.monitor.active, cleanDays: s.allPassSince === undefined ? 0 : Math.floor((now - s.allPassSince) / DAY) };
}

// The single state machine. `cause` only labels events.
export function observe(s: DomainState, r: ScanResult, now: number, cause = "scan"): void {
  const scanId = `scn_${++s.scans}`;
  s.lastScan = { id: scanId, at: now, grade: r.grade, score: r.score };
  push(s, { at: now, kind: "scan", detail: `${cause}: grade ${r.grade}, score ${r.score}`, scanId });
  const regressedNow: string[] = [];
  for (const f of r.findings) {
    const prev = s.findings[f.check];
    const plan = fixFor({ ...f, status: f.status === "PASS" ? "FAIL" : f.status } as Finding, r.domain);
    const rec: FindingRec = prev ?? { check: f.check, state: "MONITORING", status: f.status, detail: f.detail, fix: f.fix, firstSeenAt: now, episodes: 0, notProven: 0, minutesByHand: plan?.minutesByHand ?? 0, minutesWithPlan: plan?.minutesWithPlan ?? 0, credited: false };
    const was = prev?.state;
    if (f.status === "UNKNOWN") {
      // A failed read is not a pass and not a fail: never proves, never regresses.
      // Keep the last readable status and evidence; flag that this scan could not read it.
      rec.unreadable = true; if (!prev) { rec.status = "UNKNOWN"; rec.state = "UNKNOWN"; }
    } else if (f.status === "PASS") {
      rec.unreadable = false; rec.status = "PASS"; rec.detail = f.detail; rec.fix = "";
      if (was === "OPEN" || was === "REGRESSED" || was === "UNKNOWN" && rec.episodes > 0) {
        rec.state = "PROVEN_FIXED"; rec.provenAt = now; rec.proof = { scanId, at: now, detail: f.detail };
        if (!rec.credited) { rec.credited = true; s.minutesHandedBack += rec.minutesByHand - rec.minutesWithPlan; s.xp += CRIT.has(f.check) ? 100 : 50; }
        push(s, { at: now, kind: "proven_fixed", check: f.check, detail: `re-scan ${scanId} shows PASS: ${f.detail}`, scanId });
      } else if (was === undefined || was === "UNKNOWN") rec.state = "MONITORING";
    } else { // WARN or FAIL
      const wasGood = was === "PROVEN_FIXED";
      rec.unreadable = false; rec.status = f.status; rec.detail = f.detail; rec.fix = f.fix;
      if (wasGood) { rec.state = "REGRESSED"; rec.regressedAt = now; rec.episodes++; regressedNow.push(f.check); push(s, { at: now, kind: "regressed", check: f.check, detail: `fault returned (${cause}): ${f.detail}`, scanId }); }
      else if (was === "MONITORING") { rec.state = "REGRESSED"; rec.regressedAt = now; rec.episodes++; regressedNow.push(f.check); push(s, { at: now, kind: "regressed", check: f.check, detail: `a control that was passing now ${f.status}s (${cause}): ${f.detail}`, scanId }); }
      else if (was === undefined || was === "UNKNOWN") { rec.state = "OPEN"; rec.episodes++; }
      else rec.state = was;
    }
    s.findings[f.check] = rec;
  }
  // all-pass streak for L10
  if (r.findings.length && r.findings.every((x) => x.status === "PASS" || x.status === "UNKNOWN" && s.findings[x.check]?.status === "PASS")) { if (s.allPassSince === undefined) s.allPassSince = now; } else if (r.findings.some((x) => x.status === "FAIL" || x.status === "WARN")) s.allPassSince = undefined;
  // level + badge: recomputed from this scan only
  // Level is judged on last-known statuses, so an unreadable record never costs a level or a badge.
  const eff: ScanResult = { ...r, findings: r.findings.map((f) => (f.status === "UNKNOWN" && s.findings[f.check] && s.findings[f.check].status !== "UNKNOWN" ? { check: f.check, status: s.findings[f.check].status, detail: s.findings[f.check].detail, fix: s.findings[f.check].fix } : f)) };
  const lv = computeLevel(eff, ctxOf(s, now));
  const before = s.level;
  s.level = lv.level; s.levelName = lv.name;
  if (lv.level > before) push(s, { at: now, kind: "level_up", detail: `L${before} to L${lv.level} ${lv.name}`, scanId });
  if (lv.level < before) push(s, { at: now, kind: "level_down", detail: `L${before} to L${lv.level} ${lv.name}`, scanId });
  const want = lv.level >= BADGE_MIN_LEVEL ? lv.level : 0;
  const have = s.badge?.level ?? 0;
  if (want > have) {
    if (s.badge) s.badgeHistory[s.badgeHistory.length - 1].to = now;
    s.badge = { level: want, since: now, scanId }; s.badgeHistory.push({ level: want, from: now });
    push(s, { at: now, kind: "badge_earned", detail: `badge L${want}`, scanId });
  } else if (want < have) {
    const why = regressedNow.length ? `fault returned: ${regressedNow.join(", ")}` : "level fell on re-scan";
    s.badgeHistory[s.badgeHistory.length - 1].to = now; s.badgeHistory[s.badgeHistory.length - 1].lostBecause = why;
    push(s, { at: now, kind: "badge_lost", detail: `badge L${have} lost: ${why}`, scanId });
    if (want >= BADGE_MIN_LEVEL) { s.badge = { level: want, since: now, scanId }; s.badgeHistory.push({ level: want, from: now }); } else s.badge = undefined;
  }
}

// F185: state writes are compare-and-set on a per-domain revision, enforced BY THE STORE, so they hold across Worker isolates (F174's in-process
// lock below only ordered requests inside one isolate). casTx runs body (load, mutate; the state it returns carries the revision it was loaded at)
// then putCas; if another writer committed first, nothing is written and the whole body re-runs on a fresh load. Bounded; then OwnerConflictError.
// Zone writes made by a losing attempt are not rolled back: the re-run reloads, rescans and sees the zone as it is (undo is idempotent on the zone,
// and the engine re-derives a fix's record from the live zone), see the F185 receipt for what the harness shows.
export class OwnerConflictError extends Error { constructor() { super("owner_state_conflict"); } }
export const CAS_MAX_TRIES = 8;
const committed = new WeakSet<DomainState>(); // states whose final write the engine already did itself
// f368: a body that returns write:false (a rejected request that mutated nothing) is returned as read; no putCas, so the rev does not move.
export async function casTx<T>(c: Ctx, body: () => Promise<{ s: DomainState; out: T; write?: boolean }>, tries = CAS_MAX_TRIES): Promise<{ s: DomainState; out: T }> {
  for (let i = 0; i < tries; i++) {
    let r: { s: DomainState; out: T; write?: boolean };
    try { r = await body(); } catch (e) { if (e instanceof OwnerConflictError && i + 1 < tries) continue; throw e; } // a body may lose the race BEFORE any side effect (autoFix phase 1)
    if (r.write === false) return r;
    if (committed.has(r.s)) { committed.delete(r.s); return r; } // autoFix already committed its own final state (see commitMerged)
    if (!c.store.putCas) { await c.store.put(r.s); return r; }
    if (await c.store.putCas(r.s, r.s.rev ?? 0)) return r;
  }
  throw new OwnerConflictError();
}

// F174's in-process per-domain queue. SUPERSEDED by casTx for correctness (it does not cross isolates); no service path calls it any more. Kept
// exported because the F174 interleaving suite mirrors it.
const domainTails = new Map<string, Promise<unknown>>();
export async function withDomainLock<T>(domainId: string, fn: () => Promise<T>): Promise<T> {
  const prev = domainTails.get(domainId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.then(() => undefined, () => undefined);
  domainTails.set(domainId, tail);
  try { return await run; } finally { if (domainTails.get(domainId) === tail) domainTails.delete(domainId); }
}

export async function loadOrInit(c: Ctx, domainId: string, domain: string, accountId: string, verified: boolean): Promise<DomainState> {
  const s = (await c.store.get(domainId)) ?? newState(domainId, domain, accountId, verified);
  s.domainVerified = verified; return s;
}
export async function scanNow(c: Ctx, s: DomainState, cause = "scan"): Promise<ScanResult> {
  const r = await runScan(s.domain, c.doh(s.domain), c.now);
  observe(s, r, c.now(), cause);
  if (s.monitor.active) s.monitor.nextScanAt = c.now() + s.monitor.intervalMs;
  return r;
}

// ---- quests: derived from findings, completed ONLY by proof ----
export interface Quest { id: string; check: string; title: string; kind: "auto" | "guided"; severity: "FAIL" | "WARN"; minutesByHand: number; minutesWithPlan: number; xp: number; state: ProofState; reversible: boolean; evidence: string }
export function questsOf(s: DomainState): { open: Quest[]; done: Quest[] } {
  const open: Quest[] = [], done: Quest[] = [];
  for (const f of Object.values(s.findings)) {
    const fx = fixFor({ check: f.check, status: f.status === "PASS" ? "FAIL" : (f.status as "WARN"), detail: f.detail, fix: f.fix || "x" }, s.domain);
    const q: Quest = { id: `${s.domainId}:${f.check}`, check: f.check, title: fx?.title ?? f.check, kind: ["SPF", "DMARC"].includes(f.check) ? "auto" : "guided", severity: f.status === "FAIL" ? "FAIL" : "WARN", minutesByHand: f.minutesByHand, minutesWithPlan: f.minutesWithPlan, xp: ["SPF", "DMARC", "DKIM"].includes(f.check) ? 100 : 50, state: f.state, reversible: true, evidence: f.detail };
    if (f.state === "OPEN" || f.state === "REGRESSED") open.push(q); else if (f.state === "PROVEN_FIXED") done.push(q);
  }
  const rank = (q: Quest) => (q.severity === "FAIL" ? 0 : 2) + (["SPF", "DMARC", "DKIM"].includes(q.check) ? 0 : 1);
  open.sort((a, b) => rank(a) - rank(b)); return { open, done };
}

// ---- reversible auto-fix ----
export type ApplyResult = { ok: true; fix: FixRec; plan: Plan; result: "proven" | "partial" } | { ok: false; reason: "guided" | "no_zone" | "not_open" | "rolled_back" | "unknown_check"; plan?: Plan; fix?: FixRec; detail: string };
// F185: the zone write is a side effect a retry cannot take back, so autoFix commits its intent FIRST (phase 1: putCas of the state holding the new
// fix record, BEFORE applyEdits). A request that lost the race fails there, before touching the zone, and casTx re-runs it safely. After the zone
// edits and the proof re-scan, phase 2 commits the final state; if another writer slipped in between, commitMerged lays our fix record and events onto
// the fresh state and re-scans, so neither side's update is lost.
const marks = new WeakMap<DomainState, number>();
export async function autoFix(c: Ctx, s: DomainState, check: string): Promise<ApplyResult> {
  let wrote = false;
  const r = await autoFixRun(c, s, check, async () => {
    if (!c.store.putCas) return;
    if (!(await c.store.putCas(s, s.rev ?? 0))) throw new OwnerConflictError();
    wrote = true; marks.set(s, s.events.length - 1); // the fix_applied event is already in s; it is "mine" too
  });
  if (wrote) { await commitMerged(c, s, r.fix!.id); committed.add(s); }
  return r;
}
async function commitMerged(c: Ctx, s: DomainState, fixId: string) {
  const mine = s.fixes.find((f) => f.id === fixId)!; const mark = marks.get(s) ?? 0; const myEvents = s.events.slice(mark);
  for (let i = 0; i < CAS_MAX_TRIES; i++) {
    if (await c.store.putCas!(s, s.rev ?? 0)) return;
    const fresh = (await c.store.get(s.domainId))!;
    const same = fresh.fixes.findIndex((f) => f.check === mine.check && f.appliedAt === mine.appliedAt);
    if (same >= 0) { mine.id = fresh.fixes[same].id; fresh.fixes[same] = mine; } else { mine.id = `fix_${fresh.fixes.length + 1}`; fresh.fixes.push(mine); }
    for (const e of myEvents) if (!fresh.events.some((x) => x.at === e.at && x.kind === e.kind && x.detail === e.detail)) push(fresh, e);
    await scanNow(c, fresh, "merge re-scan");
    for (const k of Object.keys(s)) delete (s as unknown as Record<string, unknown>)[k];
    Object.assign(s, fresh);
  }
  throw new OwnerConflictError();
}
async function autoFixRun(c: Ctx, s: DomainState, check: string, phase1: () => Promise<void>): Promise<ApplyResult> {
  const f = s.findings[check];
  if (!f) return { ok: false, reason: "unknown_check", detail: "no such finding; scan first" };
  if (f.state !== "OPEN" && f.state !== "REGRESSED") return { ok: false, reason: "not_open", detail: `finding is ${f.state}; nothing to fix` };
  const z = c.zones.zoneFor(s.domain);
  if (!z) return { ok: false, reason: "no_zone", detail: "connect your DNS provider to let us apply this; until then follow the guide" };
  const plan = await planFor(check, s.domain, z);
  if (!plan.auto) { push(s, { at: c.now(), kind: "fix_refused", check, detail: plan.reason ?? "guided only" }); return { ok: false, reason: "guided", plan, detail: plan.reason ?? "guided only" }; }
  const before = await runScan(s.domain, c.doh(s.domain), c.now); // fresh baseline, so rollback judges against the truth, not a stale scan
  const fix: FixRec = { id: `fix_${s.fixes.length + 1}`, check, edits: plan.edits, appliedAt: c.now(), status: "applied", note: plan.summary };
  s.fixes.push(fix);
  push(s, { at: c.now(), kind: "fix_applied", check, detail: plan.summary });
  await phase1();
  await applyEdits(z, plan.edits);
  const after = await runScan(s.domain, c.doh(s.domain), c.now);
  const b = before.findings.find((x) => x.check === check)!.status, a = after.findings.find((x) => x.check === check)!.status;
  const collateral = before.findings.filter((x) => x.status === "PASS" && after.findings.find((y) => y.check === x.check)?.status !== "PASS").map((x) => x.check);
  if (collateral.length || sev(a) >= sev(b) && a !== "PASS") {
    await revertEdits(z, plan.edits); fix.status = "rolled_back";
    fix.note = collateral.length ? `rolled back: it broke ${collateral.join(", ")}` : `rolled back: re-scan did not improve ${check} (${b} to ${a})`;
    push(s, { at: c.now(), kind: "fix_rolled_back", check, detail: fix.note });
    f.notProven++;
    const restored = await runScan(s.domain, c.doh(s.domain), c.now); observe(s, restored, c.now(), "rollback re-scan");
    return { ok: false, reason: "rolled_back", plan, fix, detail: fix.note };
  }
  observe(s, after, c.now(), "post-fix re-scan");
  fix.status = s.findings[check].state === "PROVEN_FIXED" ? "proven" : "partial";
  return { ok: true, fix, plan, result: fix.status === "proven" ? "proven" : "partial" };
}
export async function undoFix(c: Ctx, s: DomainState, fixId: string): Promise<{ ok: boolean; reason?: string }> {
  const fix = s.fixes.find((x) => x.id === fixId);
  if (!fix) return { ok: false, reason: "no_such_fix" };
  if (fix.status === "undone" || fix.status === "rolled_back") return { ok: false, reason: "already_reverted" };
  const z = c.zones.zoneFor(s.domain); if (!z) return { ok: false, reason: "no_zone" };
  // never clobber later edits: the zone must still hold exactly what we wrote
  // A txt edit may already be back at its `before` set: that is a lost-CAS attempt of ours (or a request on another isolate) that reverted the zone but
  // did not get its state written. Reverting is idempotent, so the record is simply completed (F185). Anything else is a later edit: refuse.
  const norm = (a: string[]) => JSON.stringify([...a].sort());
  for (const e of fix.edits) if (e.kind === "txt") { const now = norm(await z.getTxt(e.name)); if (now !== norm(e.after) && now !== norm(e.before)) return { ok: false, reason: "zone_changed_since" }; }
  await revertEdits(z, fix.edits); fix.status = "undone";
  push(s, { at: c.now(), kind: "fix_undone", check: fix.check, detail: "owner undid the fix; exact previous records restored" });
  await scanNow(c, s, "owner undo"); return { ok: true };
}

// ---- monitor: the stays-fixed watcher ----
export function setMonitor(s: DomainState, active: boolean, now: number, intervalMs = DEFAULT_MONITOR_INTERVAL_MS) {
  if (s.monitor.active === active) return;
  s.monitor = { active, intervalMs, nextScanAt: active ? now : undefined };
  push(s, { at: now, kind: active ? "monitor_on" : "monitor_off", detail: active ? `scans every ${Math.round(intervalMs / 3_600_000)} h` : "monitor stopped" });
}
export interface Alert { domain: string; accountId: string; kind: "regressed" | "badge_lost"; detail: string }
// One pass: every due domain is re-scanned once. Returns the alerts raised. Safe to run twice (idempotent per due time).
export async function monitorTick(c: Ctx): Promise<{ scanned: number; alerts: Alert[] }> {
  const alerts: Alert[] = []; let scanned = 0;
  for (const s0 of await c.store.all()) {
    if (!s0.monitor.active || s0.monitor.nextScanAt === undefined || s0.monitor.nextScanAt > c.now()) continue;
    const mine: Alert[] = [];
    await casTx(c, async () => {
      const s = (await c.store.get(s0.domainId))!; const mark = s.events.length; mine.length = 0;
      await scanNow(c, s, "monitor");
      for (const e of s.events.slice(mark)) if (e.kind === "regressed" || e.kind === "badge_lost") mine.push({ domain: s.domain, accountId: s.accountId, kind: e.kind, detail: e.detail });
      return { s, out: null };
    });
    scanned++; alerts.push(...mine);
  }
  return { scanned, alerts };
}

// ---- reports ----
// Hours given back count ONLY fixes the latest scans still show as PASS: an undone fix, a rolled-back fix or a returned
// fault stops counting (the lifetime ledger s.minutesHandedBack only stops a repeat fix being paid twice).
export function provenMinutes(s: DomainState): number {
  return Object.values(s.findings).filter((f) => f.state === "PROVEN_FIXED" && f.credited).reduce((a, f) => a + f.minutesByHand - f.minutesWithPlan, 0);
}
export function hoursGivenBack(s: DomainState) {
  const minutes = provenMinutes(s);
  return { minutes, hours: Math.round((minutes / 60) * 10) / 10, label: "MODELLED estimate: time by hand against time with a ready-made plan, table in lib/guestscan/fixes.ts, 2026-11-06", floor: "Floor: 0 hours. Only fixes that the latest re-scan shows as PASS are counted; an undone fix or a returned fault stops counting. This is time estimated, never money received" };
}
// One model of every displayed figure; the markdown and the JSON are both rendered from it, so they cannot drift apart.
export function reportModel(s: DomainState, now: number) {
  const d = (t: number) => new Date(t).toISOString().slice(0, 10);
  const fs = Object.values(s.findings);
  const shown = (x: FixRec) => x.status === "proven" && s.findings[x.check]?.state !== "PROVEN_FIXED" ? "fault returned, not fixed now" : x.status === "partial" ? "partly fixed, not proven" : x.status === "undone" ? "undone, not fixed" : x.status === "rolled_back" ? "rolled back, not fixed" : x.status;
  return {
    domain: s.domain, date: d(now), level: s.level, levelName: s.levelName, grade: s.lastScan?.grade,
    lastScan: s.lastScan ? { date: d(s.lastScan.at), grade: s.lastScan.grade, score: s.lastScan.score } : null, monitorActive: s.monitor.active,
    findings: fs.map((f) => ({ check: f.check, state: f.state, evidence: f.detail, unreadable: !!f.unreadable, provenScanId: f.state === "PROVEN_FIXED" ? f.proof?.scanId ?? null : null, provenDate: f.state === "PROVEN_FIXED" && f.provenAt !== undefined ? d(f.provenAt) : null, regressedDate: f.state === "REGRESSED" && f.regressedAt !== undefined ? d(f.regressedAt) : null })),
    hours: hoursGivenBack(s),
    badge: s.badge ? { ...s.badge, sinceDate: d(s.badge.since) } : null,
    badgeLost: s.badgeHistory.filter((b) => b.lostBecause).map((b) => ({ level: b.level, date: d(b.to!), why: b.lostBecause! })),
    fixes: s.fixes.map((x) => ({ check: x.check, note: x.note, status: x.status, shown: shown(x) })),
  };
}
export type ReportModel = ReturnType<typeof reportModel>;
export function report(s: DomainState, now: number) {
  const m = reportModel(s, now); const h = m.hours;
  const lines = [
    `# Email security report for ${m.domain}`, `Date: ${m.date}. Business Level ${m.level} of 10 (${m.levelName}).`, "",
    `Last scan: ${m.lastScan ? `${m.lastScan.date}, grade ${m.lastScan.grade}, score ${m.lastScan.score}` : "none yet"}. Monitor: ${m.monitorActive ? "on" : "off"}.`, "",
    "## Findings and their proof", ...m.findings.map((f) => `- ${f.check}: ${f.state}${f.unreadable ? " (last scan could not read this record; showing the last readable result)" : ""}. ${f.state === "PROVEN_FIXED" ? `Proven by re-scan ${f.provenScanId} on ${f.provenDate}.` : f.state === "REGRESSED" ? `The fault returned on ${f.regressedDate}.` : f.state === "OPEN" ? "Not fixed yet." : f.state === "UNKNOWN" ? "Could not be read; not counted as a pass or a fail." : "Passing."} Evidence: ${f.evidence}`),
    "", "## Hours given back", `${h.hours} hours (${h.minutes} minutes). ${h.label}. ${h.floor}.`, "",
    "## Badge", m.badge ? `Level ${m.badge.level} badge held since ${m.badge.sinceDate}.` : "No badge held right now.",
    ...m.badgeLost.map((b) => `- Level ${b.level} badge lost on ${b.date}: ${b.why}.`),
    "", "## Changes we made for you", ...(m.fixes.length ? m.fixes.map((x) => `- ${x.check}: ${x.note} (${x.shown}).`) : ["- None."]),
    "", "Every status above comes from a DNS re-scan, never from a claim. We read public DNS records only and touch nothing on your servers.",
  ];
  return { markdown: lines.join("\n"), json: m };
}
export function overview(s: DomainState, now: number) {
  const q = questsOf(s);
  return { domain: s.domain, level: s.level, levelName: s.levelName, next: computeLevel(s.lastScan ? ({ domain: s.domain, findings: Object.values(s.findings).map((f) => ({ check: f.check, status: f.status, detail: f.detail, fix: f.fix })), grade: s.lastScan.grade as ScanResult["grade"], score: s.lastScan.score, elapsedMs: 0, modelCalls: 0, outbound: { total: 0, hosts: [] } /* rebuilt from stored state: no scan runs here, so nothing goes outbound */ }) : undefined, ctxOf(s, now)).next,
    badge: s.badge ?? null, findings: Object.values(s.findings), quests: q, hours: hoursGivenBack(s), xp: s.xp, monitor: s.monitor, lastScan: s.lastScan ?? null, events: s.events.slice(-30).reverse() };
}
