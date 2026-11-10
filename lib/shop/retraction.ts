// C5 hop 6 (plan ch.6 C5, line 1497): retraction. The publish gate blocks NEW ungraded entries, but an entry already live stayed live even when
// its regrade failed or its content went stale (f304/f312 honest limit). planRetractions names every such entry with a reason; the build removes
// them from shelf_catalogue.json and lists each one, with its reason, in retractions.json. Nothing is dropped silently, and a cap refuses a mass delete.
// Pure: no model, no network, no clock (now is injected), no fs.
import type { StoredGraded } from "./graded_store.ts";
import type { Catalogue, CatalogueEntry } from "./publish_gate.ts";
import { contentHash } from "./publish_gate.ts";

export type RetractReason = "cluster removed" | "regrade failed" | "content_hash mismatch" | "grade too old";
export type Retraction = { id: string; reason: RetractReason; detail: string };
export type RetractPolicy = {
  maxAgeDays?: number;            // grade older than this retracts; omitted = no age limit
  maxRetractFraction?: number;    // default 0.2: above it the build throws
  activeClusterIds?: string[];    // when given, an entry whose cluster is not listed is retracted (cluster removed)
};
export const DEFAULT_MAX_RETRACT_FRACTION = 0.2;
export class RetractionCapError extends Error { constructor(message: string) { super(message); this.name = "RetractionCapError"; } }
const DAY_MS = 86_400_000;

type StoreView = StoredGraded[];
// store = the stored graded runs; catalogue = the entries that would go live. Returns one {id, reason} per retracted entry, sorted by id.
// Priority when several apply: cluster removed, regrade failed, content_hash mismatch, grade too old.
export function planRetractions(store: StoreView, now: string, policy: RetractPolicy, catalogue: Catalogue): Retraction[] {
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new Error("planRetractions: now is not a valid ISO time: " + String(now));
  const runs = new Map<string, StoredGraded>();
  for (const s of store ?? []) runs.set(s.cluster_id, s);
  const active = policy?.activeClusterIds ? new Set(policy.activeClusterIds) : null;
  const out: Retraction[] = [];
  for (const e of (catalogue?.entries ?? []) as CatalogueEntry[]) {
    const id = e.cluster_id;
    const run = runs.get(id);
    let hit: Retraction | null = null;
    if (active && !active.has(id)) hit = { id, reason: "cluster removed", detail: "cluster no longer in the active cluster list" };
    else if (run && (run.pass !== true || !Array.isArray(run.checks) || run.checks.some((c) => !c || c.ok !== true))) {
      const bad = (run.checks ?? []).filter((c) => !c || c.ok !== true).map((c) => c?.id ?? "?");
      hit = { id, reason: "regrade failed", detail: "latest stored grade does not pass" + (bad.length ? ": " + bad.join(",") : "") };
    } else if (!e.shelf || e.content_hash !== contentHash(e.shelf)) {
      hit = { id, reason: "content_hash mismatch", detail: "live entry content differs from its graded hash" };
    } else if (run && run.shelf && run.content_hash !== contentHash(run.shelf)) {
      hit = { id, reason: "content_hash mismatch", detail: "stored shelf differs from its graded hash" };
    } else if (run && policy?.maxAgeDays !== undefined) {
      const at = Date.parse(run.graded_at);
      const age = (nowMs - at) / DAY_MS;
      if (!Number.isFinite(at) || age > policy.maxAgeDays) hit = { id, reason: "grade too old", detail: Number.isFinite(at) ? `graded ${age.toFixed(1)} days ago, limit ${policy.maxAgeDays}` : "graded_at unreadable" };
    }
    if (hit) out.push(hit);
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// Throws rather than mass-delete: more than maxRetractFraction of the catalogue retracting is treated as a broken input, not a clean-up.
export function assertRetractionCap(count: number, total: number, policy: RetractPolicy): void {
  const cap = policy?.maxRetractFraction ?? DEFAULT_MAX_RETRACT_FRACTION;
  if (total > 0 && count / total > cap) {
    throw new RetractionCapError(`retraction cap: ${count} of ${total} entries (${((count / total) * 100).toFixed(1)}%) would be retracted, over the ${(cap * 100).toFixed(1)}% cap; refusing to mass-delete`);
  }
}

export function applyRetractions(catalogue: Catalogue, retractions: Retraction[]): Catalogue {
  const gone = new Set(retractions.map((r) => r.id));
  return { entries: catalogue.entries.filter((e) => !gone.has(e.cluster_id)) };
}

// The two files the build writes. retractions.json is always emitted (empty list when nothing retracts) so a missing sidecar is itself a failure.
export function renderCatalogueFiles(catalogue: Catalogue, retractions: Retraction[], now: string, policy: RetractPolicy): { "shelf_catalogue.json": string; "retractions.json": string } {
  const cap = policy?.maxRetractFraction ?? DEFAULT_MAX_RETRACT_FRACTION;
  return {
    "shelf_catalogue.json": JSON.stringify({ entries: catalogue.entries.map((e) => e.shelf) }, null, 2) + "\n",
    "retractions.json": JSON.stringify({ generated_at: now, policy: { maxAgeDays: policy?.maxAgeDays ?? null, maxRetractFraction: cap }, count: retractions.length, retractions: retractions.map((r) => ({ id: r.id, reason: r.reason, detail: r.detail })) }, null, 2) + "\n",
  };
}
