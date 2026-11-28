// Declaration mailing list (2026-11-10): capture only. Never sends mail. POST /v1/subscribe { email, tags?, source?, consent: true }.
// The consent line stored is the SERVER constant, never client text. A filled honeypot (website) is answered like a success and stored nowhere.
import type { D1Like } from "./env.ts";
import { HttpError, normaliseEmail } from "./util.ts";

export const CONSENT_TEXT = "Daily artifacts from TITANOS. Unsubscribe any time.";
export const MAX_TAGS = 5;
const TAG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const SOURCE_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

export interface SubscriberStore {
  upsert(email: string, tags: string[], consentText: string, source: string, now: number): Promise<{ created: boolean }>;
}

export class D1SubscriberStore implements SubscriberStore {
  private db: D1Like;
  constructor(db: D1Like) { this.db = db; }
  async upsert(email: string, tags: string[], consentText: string, source: string, now: number): Promise<{ created: boolean }> {
    const prev = await this.db.prepare("SELECT tags FROM subscribers WHERE email = ?").bind(email).first<{ tags: string }>();
    const merged = [...new Set([...(prev ? (JSON.parse(String(prev.tags)) as string[]) : []), ...tags])].slice(0, 20);
    await this.db.prepare(
      "INSERT INTO subscribers (email, tags, consent_text, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET tags = excluded.tags, updated_at = excluded.updated_at",
    ).bind(email, JSON.stringify(merged), consentText, source, now, now).run();
    return { created: !prev };
  }
}

export class MemorySubscriberStore implements SubscriberStore {
  rows = new Map<string, { tags: string[]; consentText: string; source: string; createdAt: number; updatedAt: number }>();
  async upsert(email: string, tags: string[], consentText: string, source: string, now: number) {
    const p = this.rows.get(email);
    this.rows.set(email, { tags: [...new Set([...(p?.tags ?? []), ...tags])], consentText: p?.consentText ?? consentText, source: p?.source ?? source, createdAt: p?.createdAt ?? now, updatedAt: now });
    return { created: !p };
  }
}

export function parseSubscribe(b: Record<string, unknown>): { email: string; tags: string[]; source: string; honeypot: boolean } {
  if (typeof b.website === "string" && b.website.trim() !== "") return { email: "", tags: [], source: "web", honeypot: true };
  const email = normaliseEmail(b.email);
  if (!email) throw new HttpError(400, "invalid_email");
  if (b.consent !== true) throw new HttpError(400, "consent_required");
  const rawTags = b.tags === undefined ? [] : b.tags;
  if (!Array.isArray(rawTags) || rawTags.length > MAX_TAGS) throw new HttpError(400, "invalid_tags");
  const tags: string[] = [];
  for (const t of rawTags) { if (typeof t !== "string" || !TAG_RE.test(t)) throw new HttpError(400, "invalid_tags"); tags.push(t); }
  const source = b.source === undefined ? "web" : b.source;
  if (typeof source !== "string" || !SOURCE_RE.test(source)) throw new HttpError(400, "invalid_source");
  return { email, tags: tags.length ? tags : ["daily-artifacts"], source, honeypot: false };
}
