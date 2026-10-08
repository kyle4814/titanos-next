// TIX-999 demo core. DEMO MODE: the HMAC key lives in the browser (localStorage); production verifies server-side.
// Pure + WebCrypto only, so the same file runs in the browser and in node tests (node >= 20 has globalThis.crypto).
// Keep to erasable TypeScript (no enums / parameter properties): scripts/test_tix.mjs imports this file directly.

export const WINDOW_MS = 15000;

export type Result = "ADMIT" | "DUPLICATE" | "EXPIRED" | "FAKE";
export type Ticket = { id: string; eventId: string; owner: string; issuedAt: number };
export type TixEvent = { id: string; name: string; resaleCapCents: number };
export type Scan = { ticket: string; at: number };
export type AuditEntry = { at: number; kind: string; detail: string };
export type TixState = {
  key: string;
  events: TixEvent[];
  tickets: Ticket[];
  scans: Scan[];
  audit: AuditEntry[];
};
export type Verdict = { result: Result; ticket?: Ticket; firstScanAt?: number; reason: string };

const enc = new TextEncoder();
const MAC_BYTES = 16;

export function windowOf(now: number): number {
  return Math.floor(now / WINDOW_MS);
}

function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function newKey(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "x";
}

async function mac(keyHex: string, ticket: string, owner: string, win: number): Promise<string> {
  const raw = new Uint8Array(keyHex.match(/../g)!.map((h) => parseInt(h, 16)));
  const k = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(`${ticket}|${owner}|${win}`));
  return toHex(new Uint8Array(sig).slice(0, MAC_BYTES));
}

// Token: TIX1.<ticketId>.<ownerSlug>.<window>.<mac32hex>. ids and slugs never contain "." so the split is unambiguous.
export async function makeToken(keyHex: string, ticket: Ticket, now: number): Promise<string> {
  const o = slug(ticket.owner);
  const w = windowOf(now);
  return `TIX1.${ticket.id}.${o}.${w}.${await mac(keyHex, ticket.id, o, w)}`;
}

function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// Verifies and, on ADMIT, records the scan. Order matters: forged MAC -> FAKE first (nothing else is trusted);
// then window freshness (current or previous only) -> EXPIRED; then the one-entry rule -> DUPLICATE.
export async function verifyAndRecord(st: TixState, token: string, now: number): Promise<Verdict> {
  const p = token.trim().split(".");
  if (p.length !== 5 || p[0] !== "TIX1" || !/^\d+$/.test(p[3]) || !/^[0-9a-f]{32}$/.test(p[4])) {
    return log(st, now, { result: "FAKE", reason: "not a TIX1 token" }, token);
  }
  const [, id, owner, wStr, m] = p;
  const win = Number(wStr);
  const ticket = st.tickets.find((t) => t.id === id);
  if (!ticket || slug(ticket.owner) !== owner) return log(st, now, { result: "FAKE", reason: "unknown ticket" }, token);
  if (!safeEq(await mac(st.key, id, owner, win), m)) return log(st, now, { result: "FAKE", reason: "bad signature", ticket }, token);
  const cur = windowOf(now);
  if (win !== cur && win !== cur - 1) {
    return log(st, now, { result: "EXPIRED", reason: `code is ${cur - win} windows old (screenshot replay?)`, ticket }, token);
  }
  const first = st.scans.find((s) => s.ticket === id);
  if (first) return log(st, now, { result: "DUPLICATE", reason: "already admitted", ticket, firstScanAt: first.at }, token);
  st.scans.push({ ticket: id, at: now });
  return log(st, now, { result: "ADMIT", reason: "valid current code", ticket }, token);
}

function log(st: TixState, now: number, v: Verdict, token: string): Verdict {
  st.audit.push({ at: now, kind: `SCAN_${v.result}`, detail: `${v.ticket ? v.ticket.id : token.slice(0, 18)}: ${v.reason}` });
  return v;
}

export function emptyState(): TixState {
  return { key: newKey(), events: [], tickets: [], scans: [], audit: [] };
}

let ctr = 0;
function uid(prefix: string): string {
  ctr++;
  return `${prefix}${Date.now().toString(36)}${ctr.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function createEvent(st: TixState, name: string, resaleCapCents: number, now: number): TixEvent {
  const e = { id: uid("e"), name: name.trim() || "Demo event", resaleCapCents: Math.max(0, Math.round(resaleCapCents)) };
  st.events.push(e);
  st.audit.push({ at: now, kind: "EVENT_CREATED", detail: `${e.name}, resale cap ${money(e.resaleCapCents)}` });
  return e;
}

export function issueTicket(st: TixState, eventId: string, owner: string, now: number): Ticket {
  const t = { id: uid("t"), eventId, owner: owner.trim() || "Fan", issuedAt: now };
  st.tickets.push(t);
  st.audit.push({ at: now, kind: "TICKET_ISSUED", detail: `${t.id} to ${t.owner}` });
  return t;
}

export function setResaleCap(st: TixState, eventId: string, cents: number, now: number): void {
  const e = st.events.find((x) => x.id === eventId);
  if (!e) return;
  e.resaleCapCents = Math.max(0, Math.round(cents));
  st.audit.push({ at: now, kind: "RESALE_CAP_SET", detail: `${e.name}: ${money(e.resaleCapCents)}` });
}

export function checkResale(st: TixState, ticketId: string, priceCents: number, now: number): { ok: boolean; capCents: number } {
  const t = st.tickets.find((x) => x.id === ticketId);
  const e = t && st.events.find((x) => x.id === t.eventId);
  const cap = e ? e.resaleCapCents : 0;
  const ok = !!e && priceCents <= cap;
  st.audit.push({ at: now, kind: ok ? "RESALE_OK" : "RESALE_BLOCKED", detail: `${ticketId} at ${money(priceCents)} (cap ${money(cap)})` });
  return { ok, capCents: cap };
}

// State badge for the wallet: Issued -> Live (event active, code rotating) -> Used (scanned in).
export function ticketState(st: TixState, ticketId: string): "ISSUED" | "USED" {
  return st.scans.some((s) => s.ticket === ticketId) ? "USED" : "ISSUED";
}

export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Pairing so a second phone can run the scanner: key + registry in the URL fragment (never sent to a server).
export function exportPairing(st: TixState): string {
  const o = { k: st.key, e: st.events, t: st.tickets };
  return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function importPairing(st: TixState, blob: string): boolean {
  try {
    const b = blob.replace(/-/g, "+").replace(/_/g, "/");
    const o = JSON.parse(decodeURIComponent(escape(atob(b + "=".repeat((4 - (b.length % 4)) % 4)))));
    if (typeof o.k !== "string" || !/^[0-9a-f]{64}$/.test(o.k) || !Array.isArray(o.e) || !Array.isArray(o.t)) return false;
    st.key = o.k;
    st.events = o.e;
    st.tickets = o.t;
    st.audit.push({ at: Date.now(), kind: "PAIRED", detail: `${o.t.length} tickets imported` });
    return true;
  } catch {
    return false;
  }
}
