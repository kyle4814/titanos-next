// C5/C6 unmatched-ask log core. Pure functions plus the MemoryLog adapter. No clock, no network, no randomness of its own:
// the day comes from an injected function so the log is deterministic under test.
// Rules (shared by EVERY adapter, proved by one contract suite): no visitor identifier and no raw ask is ever stored,
// only a normalised, PII-redacted line; injection-shaped or over-long asks are rejected; one row per (day, seat, line)
// with a count; the table is bounded and evicts oldest-first.
import { normalise, tokens } from "./text.ts";
import { SEATS } from "./types.ts";
import type { ConfigStub, Seat } from "./types.ts";

export const MAX_RAW = 500;        // the router's guard length: a longer ask never reaches storage
export const MAX_LINE = 200;       // stored normalised line cap
export const ROW_CAP = 5000;       // default table bound (rows, not asks)
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type AppendResult = { status: "stored" | "rejected"; reason?: string };
export type LogEntry = { day: string; seat: Seat; normalised: string; count: number };
export interface UnmatchedLog { append(stub: ConfigStub): void | AppendResult | Promise<void | AppendResult> }
export interface ReadableLog extends UnmatchedLog { entries(limit?: number): LogEntry[] | Promise<LogEntry[]> }
export type Prepared = { ok: true; seat: Seat; normalised: string } | { ok: false; reason: string };

const ZW = new RegExp("[\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u2064\\ufeff]", "g");
const CTRL = new RegExp("[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]");
// Injection shapes: aimed at whatever reads the log later (a generator, a human, a SQL string, a prompt).
const INJECTION: RegExp[] = [
  /\b(ignore|disregard|forget|override|bypass)\b.{0,30}\b(previous|prior|above|earlier|all|any|your)\b.{0,30}\b(instruction|prompt|rule|direction|guideline)s?\b/i,
  /\b(system|developer)\s*(prompt|message|mode)\b/i,
  /\b(you are now|act as|pretend to be|jailbreak|do anything now)\b/i,
  /<\s*\/?\s*[a-z!][^>]{0,200}>/i,
  /\b(javascript|data|vbscript)\s*:/i,
  /\b(union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+\w+\s+set|select\s+.{1,60}\s+from|or\s+1\s*=\s*1|;\s*--)/i,
  /(\{\{|\}\}|\$\{|<\||\|>|\[\[|\]\])/,
  /`{3}|\bexec\s*\(|\beval\s*\(|\bonerror\s*=|\bon[a-z]{3,12}\s*=/i,
  /(\.\.\/|\.\.\\|%2e%2e|%00|\/etc\/passwd)/i,
];
// PII and secrets: redacted to a fixed marker word, never stored.
const REDACT: [RegExp, string][] = [
  [/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, " redacted-email "],
  [/\b(?:https?:\/\/|www\.)\S+/gi, " redacted-url "],
  [/\b(?:sk|pk|rk|whsec|ghp|gho|xox[a-z]|AKIA|ASIA)[-_A-Za-z0-9]{8,}/g, " redacted-secret "],
  [/\b(?=[0-9a-f]*[a-f])[0-9a-f]{8,}\b/gi, " redacted-secret "],
  [/\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{20,}\b/g, " redacted-secret "],
  [/\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/gi, " redacted-ip "],
  [/\+?\d[\d\s().-]{5,}\d/g, " redacted-number "],
  [/\b\d{5,}\b/g, " redacted-number "],
  [/\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|au|nz|uk|us|co|dev|app|ai|tech|biz|info|xyz|gov|edu)\b/gi, " redacted-domain "],
];

// Turn a stub into the only thing that may be stored, or say why it may not be. Looks at stub.ask/seat only: any other field
// on the object (ip, visitor, session, ua) is never read, so it can never be stored.
export function prepare(stub: ConfigStub): Prepared {
  const rawIn = (stub as { ask?: unknown })?.ask;
  if (typeof rawIn !== "string") return { ok: false, reason: "not_text" };
  if (rawIn.length > MAX_RAW) return { ok: false, reason: "over_guard_length" };
  const raw = rawIn.normalize("NFKC").replace(ZW, "");
  if (CTRL.test(raw)) return { ok: false, reason: "control_chars" };
  for (const re of INJECTION) if (re.test(raw)) return { ok: false, reason: "injection_shape" };
  let t = raw;
  for (const [re, to] of REDACT) t = t.replace(re, to);
  let line = normalise(t);
  if (line.length > MAX_LINE) line = line.slice(0, MAX_LINE).replace(/\s+\S*$/, "");
  if (tokens(line).length === 0) return { ok: false, reason: "empty" };
  for (const re of INJECTION) if (re.test(line)) return { ok: false, reason: "injection_shape" };
  const seat = (SEATS as string[]).includes((stub as { seat?: unknown }).seat as string) ? ((stub as { seat: Seat }).seat) : "guest";
  return { ok: true, seat, normalised: line };
}

export function mustDay(d: string): string {
  if (typeof d !== "string" || !DAY_RE.test(d)) throw new Error("day must be YYYY-MM-DD");
  return d;
}

export type LogOpts = { day?: () => string; cap?: number };

// In-memory adapter. Same contract as D1UnmatchedLog: dedup per (day, seat, line), bounded, oldest-first eviction.
export class MemoryLog implements ReadableLog {
  private m = new Map<string, LogEntry>();
  private day: () => string;
  readonly cap: number;
  constructor(o: LogOpts = {}) { this.day = o.day ?? (() => "0000-00-00"); this.cap = Math.max(1, o.cap ?? ROW_CAP); }
  append(stub: ConfigStub): AppendResult {
    const p = prepare(stub);
    if (!p.ok) return { status: "rejected", reason: p.reason };
    const day = this.day();
    if (!DAY_RE.test(day)) throw new Error("day must be YYYY-MM-DD");
    const k = day + "\u0000" + p.seat + "\u0000" + p.normalised;
    const e = this.m.get(k);
    if (e) e.count++;
    else this.m.set(k, { day, seat: p.seat, normalised: p.normalised, count: 1 });
    while (this.m.size > this.cap) this.m.delete(this.m.keys().next().value as string);
    return { status: "stored" };
  }
  entries(limit = ROW_CAP): LogEntry[] { return [...this.m.values()].slice(0, Math.max(0, limit)).map((e) => ({ ...e })); }
  // Compatibility view for the original w6 test: stub-shaped rows.
  get rows(): (ConfigStub & { count: number })[] {
    return this.entries().map((e) => ({ ask: e.normalised, normalised: e.normalised, seat: e.seat, status: "LOGGED_FOR_GENERATOR", quote: null, count: e.count }));
  }
}
