// D1 adapters for the C5 demand chain (f301): UnmatchedLog (concierge asks) and GeneratorQueue (ranked clusters), plus their row mappers.
// Style follows d1_plan_store.ts: bound args only, one statement per write, absent optionals read back as null. Not wired into the Worker; no live D1.
// The caller supplies askerId and the timestamps (ISO-8601 text); nothing here reads a clock.
import type { D1Like } from "./env.ts";
import type { ConfigStub } from "../../lib/concierge/types.ts";
import type { AskRecord } from "../../lib/concierge/demand.ts";
import type { AsyncGeneratorQueue, QueueEntry } from "../../lib/concierge/genqueue.ts";

type Row = Record<string, unknown>;
const strOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const ANON = "anon";

export const toLogRow = (r: Row): ConfigStub => ({
  ask: String(r.ask), normalised: String(r.normalised), seat: String(r.seat) as ConfigStub["seat"], status: "LOGGED_FOR_GENERATOR", quote: null,
  askerId: String(r.asker_id) === ANON ? null : String(r.asker_id), firstSeenAt: strOrNull(r.first_seen_at), lastSeenAt: strOrNull(r.last_seen_at), seenCount: Number(r.seen_count),
});

export const toQueueEntry = (r: Row): QueueEntry => ({
  cluster_id: String(r.cluster_id), label: String(r.label), ask_count: Number(r.ask_count), distinct_askers: Number(r.distinct_askers),
  first_seen: strOrNull(r.first_seen), last_seen: strOrNull(r.last_seen), sample_asks: JSON.parse(String(r.sample_asks_json ?? "[]")) as string[], status: "QUEUED_FOR_GENERATOR",
});

// Log rows -> demandReport input. One record per sighting (seen_count), first sighting stamped first_seen_at, the rest last_seen_at, so ask_count, first/last seen and distinct askers all survive.
export function toAskRecords(rows: ConfigStub[]): AskRecord[] {
  const out: AskRecord[] = [];
  for (const r of rows) {
    const n = Math.max(1, r.seenCount ?? 1);
    for (let i = 0; i < n; i++) out.push({ ask: r.ask, askerId: r.askerId ?? null, seat: r.seat, seenAt: i === 0 ? (r.firstSeenAt ?? null) : (r.lastSeenAt ?? null) });
  }
  return out;
}

const earlier = (col: string) => `CASE WHEN excluded.${col} IS NOT NULL AND (unmatched_log.${col} IS NULL OR excluded.${col} < unmatched_log.${col}) THEN excluded.${col} ELSE unmatched_log.${col} END`;
const later = (col: string) => `CASE WHEN excluded.${col} IS NOT NULL AND (unmatched_log.${col} IS NULL OR excluded.${col} > unmatched_log.${col}) THEN excluded.${col} ELSE unmatched_log.${col} END`;

export class D1UnmatchedLog {
  private db: D1Like;
  constructor(db: D1Like) { this.db = db; }
  // ONE upsert: new (normalised, asker) inserts; the same asker again bumps seen_count, keeps the earliest first_seen_at and the latest last_seen_at.
  async append(s: ConfigStub): Promise<void> {
    const seen = s.lastSeenAt ?? s.firstSeenAt ?? null, first = s.firstSeenAt ?? seen;
    await this.db.prepare(
      "INSERT INTO unmatched_log (normalised, asker_id, ask, seat, status, seen_count, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT(normalised, asker_id) DO UPDATE SET seen_count = unmatched_log.seen_count + 1, first_seen_at = " + earlier("first_seen_at") + ", last_seen_at = " + later("last_seen_at"),
    ).bind(s.normalised, s.askerId ? String(s.askerId) : ANON, s.ask, s.seat, s.status, first, seen).run();
  }
  async rows(): Promise<ConfigStub[]> { return (await this.db.prepare("SELECT * FROM unmatched_log ORDER BY normalised, asker_id").bind().all<Row>()).results.map(toLogRow); }
  async askRecords(): Promise<AskRecord[]> { return toAskRecords(await this.rows()); }
}

export class D1GeneratorQueue implements AsyncGeneratorQueue {
  private db: D1Like;
  constructor(db: D1Like) { this.db = db; }
  async list(): Promise<QueueEntry[]> { return (await this.db.prepare("SELECT * FROM generator_queue ORDER BY cluster_id").bind().all<Row>()).results.map(toQueueEntry); }
  // Snapshot replace, all or nothing: DELETE + INSERTs in one batch (D1 batch = one implicit transaction).
  async replaceAll(entries: QueueEntry[]): Promise<void> {
    const stmts = [this.db.prepare("DELETE FROM generator_queue").bind(), ...entries.map((e) => this.db.prepare(
      "INSERT INTO generator_queue (cluster_id, label, ask_count, distinct_askers, first_seen, last_seen, sample_asks_json, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(e.cluster_id, e.label, e.ask_count, e.distinct_askers, e.first_seen, e.last_seen, JSON.stringify(e.sample_asks), e.status))];
    if (!this.db.batch) throw new Error("D1 batch unavailable: refusing a non-atomic queue replace");
    await this.db.batch(stmts);
  }
}
