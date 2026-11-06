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
}
export interface OwnerStore { get(domainId: string): Promise<DomainState | undefined>; put(s: DomainState): Promise<void>; all(): Promise<DomainState[]> }
export class MemoryOwnerStore implements OwnerStore {
  m = new Map<string, DomainState>();
  async get(id: string) { const s = this.m.get(id); return s ? structuredClone(s) : undefined; }
  async put(s: DomainState) { const cur = this.m.get(s.domainId); if (cur && cur.accountId !== s.accountId) throw new Error("owner_state_account_mismatch"); this.m.set(s.domainId, structuredClone(s)); }
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
    cur.monitor = { active, intervalMs: intervalMs ?? cur.monitor.intervalMs, nextScanAt: active ? now : undefined }; return "changed";
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

// F174: every owner request is load, mutate, put on its OWN copy of the state, and the mutate step awaits DNS and the store. Two requests on one
// domain used to interleave at those awaits: both undos could win, and the later put overwrote the other's fix record (lost update). Requests on one
// domain now run one at a time. Scope: one runtime (one Worker isolate interleaves requests exactly like this); several isolates need a store-level
// compare-and-set or a Durable Object, see the F174 receipt WOULD-FLIP.
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
export async function autoFix(c: Ctx, s: DomainState, check: string): Promise<ApplyResult> {
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
  await applyEdits(z, plan.edits);
  push(s, { at: c.now(), kind: "fix_applied", check, detail: plan.summary });
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
  for (const e of fix.edits) if (e.kind === "txt") { const now = await z.getTxt(e.name); if (JSON.stringify([...now].sort()) !== JSON.stringify([...e.after].sort())) return { ok: false, reason: "zone_changed_since" }; }
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
    await withDomainLock(s0.domainId, async () => {
      const s = (await c.store.get(s0.domainId))!; const mark = s.events.length;
      await scanNow(c, s, "monitor"); scanned++;
      for (const e of s.events.slice(mark)) if (e.kind === "regressed" || e.kind === "badge_lost") alerts.push({ domain: s.domain, accountId: s.accountId, kind: e.kind, detail: e.detail });
      await c.store.put(s);
    });
  }
  return { scanned, alerts };
}

// ---- reports ----
export function hoursGivenBack(s: DomainState) { return { minutes: s.minutesHandedBack, hours: Math.round((s.minutesHandedBack / 60) * 10) / 10, label: "MODELLED estimate: time by hand against time with a ready-made plan, table in lib/guestscan/fixes.ts, 2026-11-06" }; }
export function report(s: DomainState, now: number) {
  const fs = Object.values(s.findings);
  const h = hoursGivenBack(s);
  const d = (t: number) => new Date(t).toISOString().slice(0, 10);
  const lines = [
    `# Email security report for ${s.domain}`, `Date: ${d(now)}. Business Level ${s.level} of 10 (${s.levelName}).`, "",
    `Last scan: ${s.lastScan ? `${d(s.lastScan.at)}, grade ${s.lastScan.grade}, score ${s.lastScan.score}` : "none yet"}. Monitor: ${s.monitor.active ? "on" : "off"}.`, "",
    "## Findings and their proof", ...fs.map((f) => `- ${f.check}: ${f.state}${f.unreadable ? " (last scan could not read this record; showing the last readable result)" : ""}. ${f.state === "PROVEN_FIXED" ? `Proven by re-scan ${f.proof?.scanId} on ${d(f.provenAt!)}.` : f.state === "REGRESSED" ? `The fault returned on ${d(f.regressedAt!)}.` : f.state === "OPEN" ? "Not fixed yet." : f.state === "UNKNOWN" ? "Could not be read; not counted as a pass or a fail." : "Passing."} Evidence: ${f.detail}`),
    "", "## Hours given back", `${h.hours} hours (${h.minutes} minutes). ${h.label}.`, "",
    "## Badge", s.badge ? `Level ${s.badge.level} badge held since ${d(s.badge.since)}.` : "No badge held right now.",
    ...s.badgeHistory.filter((b) => b.lostBecause).map((b) => `- Level ${b.level} badge lost on ${d(b.to!)}: ${b.lostBecause}.`),
    "", "## Changes we made for you", ...(s.fixes.length ? s.fixes.map((x) => `- ${x.check}: ${x.note} (${x.status}).`) : ["- None."]),
    "", "Every status above comes from a DNS re-scan, never from a claim. We read public DNS records only and touch nothing on your servers.",
  ];
  return { markdown: lines.join("\n"), json: { domain: s.domain, date: d(now), level: s.level, levelName: s.levelName, grade: s.lastScan?.grade, findings: fs.map((f) => ({ check: f.check, state: f.state, evidence: f.detail })), hours: h, badge: s.badge ?? null } };
}
export function overview(s: DomainState, now: number) {
  const q = questsOf(s);
  return { domain: s.domain, level: s.level, levelName: s.levelName, next: computeLevel(s.lastScan ? ({ domain: s.domain, findings: Object.values(s.findings).map((f) => ({ check: f.check, status: f.status, detail: f.detail, fix: f.fix })), grade: s.lastScan.grade as ScanResult["grade"], score: s.lastScan.score, elapsedMs: 0, modelCalls: 0 }) : undefined, ctxOf(s, now)).next,
    badge: s.badge ?? null, findings: Object.values(s.findings), quests: q, hours: hoursGivenBack(s), xp: s.xp, monitor: s.monitor, lastScan: s.lastScan ?? null, events: s.events.slice(-30).reverse() };
}
