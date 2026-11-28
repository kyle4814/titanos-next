import { json, text } from "../http.ts";
import { HttpError } from "../util.ts";
import { BOOKING } from "./config.ts";
import { createBooking, listFreeSlots } from "./service.ts";
import { bookingIcs } from "./ics.ts";
import { HONEYPOT_FIELD } from "./validate.ts";
import type { BookingDeps } from "./types.ts";

export const BOOKING_PATH = /^\/api\/(slots|book)(\/|$)/;
const MAX_BODY = 16 * 1024;
const ID_RE = /^bk_[0-9a-f]{32}$/;

// The cross-origin guard for a state-changing public route. A browser always sends Origin on a cross-origin POST, so any
// Origin other than the site's own is refused, and so is a request the browser itself marks cross-site. No Origin and no
// Sec-Fetch-Site (curl, server to server) passes this guard and meets the rate limit instead. JSON-only bodies force a
// CORS preflight for every other origin.
export function crossOriginRefused(req: Request, siteOrigin: string): boolean {
  const o = req.headers.get("origin");
  if (o !== null) return o !== siteOrigin;
  const sf = req.headers.get("sec-fetch-site");
  return sf !== null && sf !== "same-origin" && sf !== "same-site" && sf !== "none";
}

export interface BookingCtx { booking?: BookingDeps; now: () => number; siteOrigin: string }
export async function bookingRoute(req: Request, path: string, d: BookingCtx, limit: () => Promise<void>): Promise<Response> {
  const m = req.method;
  const b = d.booking;
  if (!b) return json({ error: "booking_unavailable" }, 503);
  const seg = path.split("/").filter(Boolean);   // ["api", "slots"] | ["api", "book", id?, "ics"?]
  if (seg[1] === "slots" && seg.length === 2) {
    if (m !== "GET") return json({ error: "method_not_allowed" }, 405);
    return json(await listFreeSlots(b, d.now()));
  }
  if (seg[1] === "book" && seg.length === 2) {
    if (m !== "POST") return json({ error: "method_not_allowed" }, 405);
    if (crossOriginRefused(req, d.siteOrigin)) throw new HttpError(403, "cross_origin");
    const ct = req.headers.get("content-type");
    if (ct === null || !/^application\/json\s*(?:;|$)/i.test(ct.trim())) throw new HttpError(415, "unsupported_media_type");
    await limit();   // every attempt counts, valid or not
    const t = await req.text();
    if (t.length > MAX_BODY) throw new HttpError(413, "body_too_large");
    let raw: unknown;
    try { raw = JSON.parse(t); } catch { throw new HttpError(400, "invalid_json"); }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new HttpError(400, "invalid_json");
    const body = raw as Record<string, unknown>;
    const trap = body[HONEYPOT_FIELD];
    if (typeof trap === "string" ? trap.trim() !== "" : trap !== undefined && trap !== null) {
      b.log?.("booking honeypot tripped");
      return json({ ok: true }, 201);   // looks like success to a bot; nothing is stored and nobody is alerted
    }
    return json({ ok: true, ...(await createBooking(b, body, d.now())), tz: (b.config ?? BOOKING).tzName }, 201);
  }
  if (seg[1] === "book" && (seg.length === 3 || (seg.length === 4 && seg[3] === "ics"))) {
    if (m !== "GET") return json({ error: "method_not_allowed" }, 405);
    if (!ID_RE.test(seg[2])) return json({ error: "not_found" }, 404);
    const row = await b.store.get(seg[2]);
    if (!row || row.status !== "confirmed") return json({ error: "not_found" }, 404);
    if (seg.length === 4) return text(bookingIcs(row), "text/calendar; charset=utf-8", { "content-disposition": 'attachment; filename="call-with-kyle.ics"' });
    return json({ id: row.id, name: row.name, business: row.business, startMs: row.slotStart, endMs: row.slotEnd, start: new Date(row.slotStart).toISOString(), tz: (b.config ?? BOOKING).tzName });
  }
  return json({ error: "not_found", path }, 404);
}
