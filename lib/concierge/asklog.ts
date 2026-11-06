// F45 ask log: the machinery for the first 200 real visitor asks. Node/server side only (node:crypto, node:fs); never imported by the browser widget.
// Stores ONLY: ask_id, ts, salted-hash visitor id, scrubbed question text, matched intent, confidence. No IP field exists; unknown keys are rejected.
import { createHash } from "node:crypto";
import fs from "node:fs";
import type { Reply } from "./types.ts";

export type AskRow = { ask_id: string; ts: string; visitor: string; q: string; intent: string; conf: number; synthetic?: true };
export const ASK_KEYS = ["ask_id", "ts", "visitor", "q", "intent", "conf", "synthetic"] as const;
export const MAX_Q = 300;
export const MIN_SALT = 16;

// Strip emails, ABNs, cards and phone-shaped numbers BEFORE storage. Order matters: email, labelled ABN, card-length runs, AU phones, bare ABN, 1300/1800, international, any other 8+ digit run.
export function scrubPii(raw: string): string {
  let s = String(raw ?? "");
  s = s.replace(/[A-Za-z0-9._%+'-]+\s*(?:@|\(at\)|\[at\])\s*[A-Za-z0-9-]+(?:\s*(?:\.|\(dot\)|\[dot\])\s*[A-Za-z0-9-]+)+/gi, "[EMAIL]");
  s = s.replace(/\b(?:abn|acn)\b[\s:#.-]*(?:\d[\s-]?){8,11}/gi, "[ABN]");
  s = s.replace(/(?<![\d])(?:\d[\s-]?){12,18}\d(?![\d])/g, "[NUMBER]");
  s = s.replace(/(?<![\w])(?:\+\s?61[\s-]?\(?0?\)?[\s-]?[2-9]\d{2}[\s-]?\d{3}[\s-]?\d{3}|\(?0[2-9]\)?[\s-]?(?:\d{4}[\s-]?\d{4}|\d{2}[\s-]?\d{3}[\s-]?\d{3}|\d{3}[\s-]?\d{3}[\s-]?\d{3}))(?![\d])/g, "[PHONE]");
  s = s.replace(/(?<![\d])(?:\d{2}[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3})(?![\d])/g, "[ABN]");          // bare 11 digits, ABN shape
  s = s.replace(/(?<![\w])1[38]00[\s-]?\d{3}[\s-]?\d{3}(?![\d])/g, "[PHONE]");
  s = s.replace(/(?<![\w])\+\d{1,3}[\s-]?\(?\d{1,4}\)?(?:[\s-]?\d{2,4}){2,4}(?![\d])/g, "[PHONE]");     // other international
  s = s.replace(/(?<![\w])(?:\d[\s.-]?){7,}\d(?![\d])/g, "[NUMBER]");                                  // any remaining 8+ digit run
  return s.replace(/\s+/g, " ").trim().slice(0, MAX_Q);
}

export function hashVisitor(salt: string, visitorId: string): string {
  if (typeof salt !== "string" || salt.length < MIN_SALT) throw new Error("asklog: salt must be at least " + MIN_SALT + " characters");
  return createHash("sha256").update(salt + ":" + String(visitorId)).digest("hex").slice(0, 16);
}

export function intentOf(r: Reply): { intent: string; conf: number } {
  const round = (n: number) => Math.round(n * 100) / 100;
  if (r.kind === "match") return { intent: r.shelf.id, conf: round(r.score) };
  if (r.kind === "ask") return { intent: "ask", conf: round(r.score) };
  return { intent: r.reason === "junk" ? "junk" : "none", conf: 0 };
}

export function makeRow(a: { salt: string; visitorId: string; question: string; reply: Reply; ts: string; synthetic?: boolean }): AskRow {
  const { intent, conf } = intentOf(a.reply);
  const visitor = hashVisitor(a.salt, a.visitorId);
  const q = intent === "junk" ? "" : scrubPii(a.question);   // junk text is never kept
  const ask_id = createHash("sha256").update(visitor + "|" + a.ts + "|" + q).digest("hex").slice(0, 12);
  const row: AskRow = { ask_id, ts: a.ts, visitor, q, intent, conf };
  if (a.synthetic) row.synthetic = true;
  return row;
}

// Strict validation: used on read, so a row carrying an ip (or anything unknown) is refused, not silently kept.
export function validateRow(x: unknown): AskRow {
  if (!x || typeof x !== "object" || Array.isArray(x)) throw new Error("row is not an object");
  const o = x as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!(ASK_KEYS as readonly string[]).includes(k)) throw new Error("unknown field '" + k + "' (the ask log stores no IP and nothing outside the schema)");
  if (typeof o.ask_id !== "string" || !/^[0-9a-f]{12}$/.test(o.ask_id)) throw new Error("bad ask_id");
  if (typeof o.ts !== "string" || Number.isNaN(Date.parse(o.ts))) throw new Error("bad ts");
  if (typeof o.visitor !== "string" || !/^[0-9a-f]{16}$/.test(o.visitor)) throw new Error("bad visitor (must be a 16 hex salted hash)");
  if (typeof o.q !== "string" || o.q.length > MAX_Q) throw new Error("bad q");
  if (scrubPii(o.q) !== o.q.replace(/\s+/g, " ").trim()) throw new Error("q still contains PII-shaped text");
  if (typeof o.intent !== "string" || !o.intent) throw new Error("bad intent");
  if (typeof o.conf !== "number" || !Number.isFinite(o.conf)) throw new Error("bad conf");
  if (o.synthetic !== undefined && o.synthetic !== true) throw new Error("bad synthetic flag");
  return o as unknown as AskRow;
}

export interface AskLog { append(row: AskRow): void | Promise<void>; all(): AskRow[] | Promise<AskRow[]> }

export class MemoryAskLog implements AskLog {
  rows: AskRow[] = [];
  append(r: AskRow) { this.rows.push(validateRow(r)); }
  all() { return this.rows.slice(); }
}

export class JsonlAskLog implements AskLog {
  readonly path: string;
  constructor(path: string) { this.path = path; }
  append(r: AskRow) { fs.appendFileSync(this.path, JSON.stringify(validateRow(r)) + "\n"); }
  all(): AskRow[] { return readAskJsonl(this.path); }
}

export function parseAskJsonl(text: string, label = "log"): AskRow[] {
  const out: AskRow[] = [];
  text.split("\n").forEach((line, i) => {
    if (!line.trim()) return;
    let j: unknown;
    try { j = JSON.parse(line); } catch { throw new Error(label + " line " + (i + 1) + ": not JSON"); }
    try { out.push(validateRow(j)); } catch (e) { throw new Error(label + " line " + (i + 1) + ": " + (e as Error).message); }
  });
  return out;
}
export function readAskJsonl(path: string): AskRow[] { return fs.existsSync(path) ? parseAskJsonl(fs.readFileSync(path, "utf8"), path) : []; }

// Record one ask. ts is injected (the library has no clock). A failing adapter never breaks the reply path.
export async function recordAsk(log: AskLog, a: Parameters<typeof makeRow>[0]): Promise<boolean> {
  try { await log.append(makeRow(a)); return true; } catch { return false; }
}
