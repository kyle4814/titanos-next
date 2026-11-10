// C5 hop 2 (plan ch.6 C5, line 1497): demand clusters (demand.ts) -> a ranked, de-duplicated GeneratorQueue.
// Pure core (mergeDemand) + a storage interface with an in-memory adapter and a recording test adapter. NO D1 write, no clock, no network.
// An entry is only a queue row (status QUEUED_FOR_GENERATOR). It has no shelf shape and no grade, so it can never be shown or sold;
// the one door to a live shelf stays lib/shop/grader.ts. Snapshot semantics: counts are of the whole log, so re-running is a no-op.
import { demandReport, CLUSTER_JAC, type AskRecord, type DemandOpts, type ShelfStub } from "./demand.ts";

export type QueueEntry = {
  cluster_id: string; label: string; ask_count: number; distinct_askers: number;
  first_seen: string | null; last_seen: string | null; sample_asks: string[]; status: "QUEUED_FOR_GENERATOR";
};
export interface GeneratorQueue { list(): QueueEntry[]; replaceAll(entries: QueueEntry[]): void }
// f301: the async twin for a D1 adapter (D1 calls are promises). Same two methods, same snapshot semantics.
export interface AsyncGeneratorQueue { list(): Promise<QueueEntry[]>; replaceAll(entries: QueueEntry[]): Promise<void> }
export class MemoryQueue implements GeneratorQueue {
  rows: QueueEntry[] = [];
  list() { return this.rows.map((r) => ({ ...r, sample_asks: [...r.sample_asks] })); }
  replaceAll(e: QueueEntry[]) { this.rows = e.map((r) => ({ ...r, sample_asks: [...r.sample_asks] })); }
}
// Test adapter: same behaviour as MemoryQueue, plus a write log so a test can prove a re-run wrote nothing.
export class RecordingQueue extends MemoryQueue { writes = 0; replaceAll(e: QueueEntry[]) { this.writes++; super.replaceAll(e); } }

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const minS = (a: string | null, b: string | null) => (a === null ? b : b === null ? a : a <= b ? a : b);
const maxS = (a: string | null, b: string | null) => (a === null ? b : b === null ? a : a >= b ? a : b);
const set = (label: string) => new Set(label.split(" ").filter(Boolean));   // label is already the sorted token key: do not re-stem
const jac = (a: Set<string>, b: Set<string>) => { let i = 0; for (const t of a) if (b.has(t)) i++; return i / (a.size + b.size - i || 1); };
const sameEntry = (a: QueueEntry, b: QueueEntry) => JSON.stringify(a) === JSON.stringify(b);

export function rankQueue(es: QueueEntry[]): QueueEntry[] {
  return [...es].sort((a, b) => b.distinct_askers - a.distinct_askers || b.ask_count - a.ask_count || cmp(b.last_seen ?? "", a.last_seen ?? "") || cmp(a.label, b.label) || cmp(a.cluster_id, b.cluster_id));
}

// Fold stubs into the existing queue. A stub joins an entry if the cluster_id matches or the labels are near-duplicates (Jaccard >= jacMin);
// two stubs landing on one entry are summed within the run, then the entry keeps max(old, new) so a shorter log can never shrink demand.
export function mergeDemand(existing: QueueEntry[], stubs: ShelfStub[], jacMin = CLUSTER_JAC): QueueEntry[] {
  const out = existing.map((e) => ({ ...e, sample_asks: [...e.sample_asks] }));
  const sets = out.map((e) => set(e.label));
  const folded = new Map<number, QueueEntry>();   // per-run accumulation for each existing/new slot
  for (const s of [...stubs].sort((a, b) => cmp(a.label, b.label) || cmp(a.cluster_id, b.cluster_id))) {
    if (s.status !== "UNGRADED_PROPOSAL") continue;
    const st = set(s.label);
    let idx = out.findIndex((e) => e.cluster_id === s.cluster_id);
    if (idx < 0) idx = out.findIndex((_, i) => jac(sets[i], st) >= jacMin);
    if (idx < 0) {
      out.push({ cluster_id: s.cluster_id, label: s.label, ask_count: s.ask_count, distinct_askers: s.distinct_askers, first_seen: s.first_seen, last_seen: s.last_seen, sample_asks: [...s.sample_asks], status: "QUEUED_FOR_GENERATOR" });
      sets.push(st); folded.set(out.length - 1, { ...out[out.length - 1] });
      continue;
    }
    const acc = folded.get(idx);
    if (!acc) { folded.set(idx, { ...out[idx], ask_count: s.ask_count, distinct_askers: s.distinct_askers, sample_asks: [...s.sample_asks] }); }
    else { acc.ask_count += s.ask_count; acc.distinct_askers += s.distinct_askers; acc.sample_asks = [...new Set([...acc.sample_asks, ...s.sample_asks])].sort((a, b) => a.length - b.length || cmp(a, b)).slice(0, 3); }
    const cur = folded.get(idx)!;
    cur.first_seen = minS(cur.first_seen, s.first_seen); cur.last_seen = maxS(cur.last_seen, s.last_seen);
  }
  for (const [i, acc] of folded) {
    const old = out[i];
    out[i] = { ...old, ask_count: Math.max(old.ask_count, acc.ask_count), distinct_askers: Math.max(old.distinct_askers, acc.distinct_askers),
      first_seen: minS(old.first_seen, acc.first_seen), last_seen: maxS(old.last_seen, acc.last_seen),
      sample_asks: old.sample_asks.length && sameSamples(old, acc) ? old.sample_asks : [...new Set([...old.sample_asks, ...acc.sample_asks])].sort((a, b) => a.length - b.length || cmp(a, b)).slice(0, 3) };
  }
  return rankQueue(out);
}
const sameSamples = (a: QueueEntry, b: QueueEntry) => b.sample_asks.every((x) => a.sample_asks.includes(x));

export type EnqueueResult = { queued: number; changed: boolean; entries: QueueEntry[] };
// The one entry point: log records -> demandReport -> merge -> write only if something changed. Idempotent.
export function enqueueDemand(queue: GeneratorQueue, records: AskRecord[], opts: DemandOpts = {}): EnqueueResult {
  const before = queue.list();
  const after = mergeDemand(before, demandReport(records, { ...opts, topN: opts.topN ?? 1000 }));
  const changed = after.length !== before.length || after.some((e, i) => !sameEntry(e, rankQueue(before)[i]));
  if (changed) queue.replaceAll(after);
  return { queued: after.length, changed, entries: after };
}

// Async entry point for a D1-backed queue: identical merge and change-detection, so a re-run over the same log writes nothing.
export async function enqueueDemandAsync(queue: AsyncGeneratorQueue, records: AskRecord[], opts: DemandOpts = {}): Promise<EnqueueResult> {
  const before = await queue.list();
  const after = mergeDemand(before, demandReport(records, { ...opts, topN: opts.topN ?? 1000 }));
  const sortedBefore = rankQueue(before);
  const changed = after.length !== before.length || after.some((e, i) => !sameEntry(e, sortedBefore[i]));
  if (changed) await queue.replaceAll(after);
  return { queued: after.length, changed, entries: after };
}
