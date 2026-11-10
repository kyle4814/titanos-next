// C5 hop 7 (f317): the ONE build entry point. It owns the retraction policy, so a caller cannot build a catalogue without retraction:
// CatalogueBuildConfig has no `retract` field, and runCatalogueBuild always hands buildCatalogueFromStore a retract policy with an explicit maxAgeDays.
// Pure apart from the injected store: no clock (now is required), no fs, no model, no network. The CLI (scripts/build_shelf_catalogue.mjs) is the only fs edge.
import { buildCatalogueFromStore, BuildBlockedError } from "./graded_store.ts";
import type { GradedRunStore, BuildResult, Offender } from "./graded_store.ts";
import { RetractionCapError } from "./retraction.ts";
import { serialiseCatalogue } from "./build_catalogue.ts";
import type { Catalogue } from "./publish_gate.ts";

// A stored grade older than this many days is retracted (reason "grade too old"). 90 = one quarter: a shelf not regraded in a quarter is not
// vouched for. A regrade resets graded_at. Pass cfg.maxAgeDays to change it; it can never be "unset", because a missing limit would silently disable ageing.
export const DEFAULT_MAX_AGE_DAYS = 90;

export type CatalogueBuildConfig = {
  now: string;                       // ISO time, injected (the CLI supplies the clock)
  base?: Catalogue;                  // the catalogue already live (read back from the previous build)
  expectIds?: string[];              // cluster ids that MUST have a stored grader run
  maxAgeDays?: number;               // default DEFAULT_MAX_AGE_DAYS; must be a finite number > 0
  maxRetractFraction?: number;       // default 0.2 (retraction.ts); above it the build refuses
  activeClusterIds?: string[];       // when given, a live entry whose cluster is not listed is retracted
  allowEmptyShelf?: boolean;         // override: let retractions take a non-empty live catalogue to zero entries
};

export type CatalogueBuildFiles = { "shelf_catalogue.json": string; "retractions.json": string };
export type CatalogueBuildOutcome =
  | { ok: true; result: BuildResult; files: CatalogueBuildFiles }
  | { ok: false; kind: "blocked"; offenders: Offender[]; message: string }
  | { ok: false; kind: "cap"; offenders: Offender[]; message: string }
  | { ok: false; kind: "empty-shelf"; offenders: Offender[]; message: string }
  | { ok: false; kind: "assert"; offenders: Offender[]; message: string };

// Exit codes for the CLI: 0 ok, 1 blocked or assert, 2 retraction cap, 3 would empty a live shelf.
export const EXIT = { ok: 0, blocked: 1, cap: 2, emptyShelf: 3 } as const;
export function exitCodeFor(o: CatalogueBuildOutcome): number {
  if (o.ok) return EXIT.ok;
  return o.kind === "cap" ? EXIT.cap : o.kind === "empty-shelf" ? EXIT.emptyShelf : EXIT.blocked;
}

export async function runCatalogueBuild(store: GradedRunStore, cfg: CatalogueBuildConfig): Promise<CatalogueBuildOutcome> {
  if (!cfg || typeof cfg.now !== "string" || !Number.isFinite(Date.parse(cfg.now))) throw new Error("runCatalogueBuild: cfg.now must be a valid ISO time");
  const maxAgeDays = cfg.maxAgeDays === undefined ? DEFAULT_MAX_AGE_DAYS : cfg.maxAgeDays;
  if (typeof maxAgeDays !== "number" || !Number.isFinite(maxAgeDays) || maxAgeDays <= 0) throw new Error("runCatalogueBuild: maxAgeDays must be a finite number > 0, got " + String(maxAgeDays));
  const base = cfg.base ?? { entries: [] };
  let result: BuildResult;
  try {
    result = await buildCatalogueFromStore(store, {
      base, expectIds: cfg.expectIds,
      retract: { now: cfg.now, maxAgeDays, maxRetractFraction: cfg.maxRetractFraction, activeClusterIds: cfg.activeClusterIds },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (e instanceof BuildBlockedError) return { ok: false, kind: "blocked", offenders: e.offenders, message };
    if (e instanceof RetractionCapError) return { ok: false, kind: "cap", offenders: [], message };
    return { ok: false, kind: "assert", offenders: [], message };
  }
  const files = result.files;
  if (!files) throw new Error("runCatalogueBuild: retract policy was not applied (internal invariant)");
  if (!cfg.allowEmptyShelf && base.entries.length > 0 && result.catalogue.entries.length === 0) {
    return { ok: false, kind: "empty-shelf", offenders: result.retractions.map((r) => ({ cluster_id: r.id, reason: r.reason })),
      message: `retraction would empty the live shelf: ${base.entries.length} live entries, all ${result.retractions.length} retracted; pass allowEmptyShelf (--allow-empty-shelf) to confirm` };
  }
  // The catalogue file keeps the full entries (content_hash + shelf) so the next build can read it back as `base`; retractions.json is the f316 sidecar.
  return { ok: true, result, files: { "shelf_catalogue.json": serialiseCatalogue(result.catalogue), "retractions.json": files["retractions.json"] } };
}

// Read-only store over records already in memory (what the CLI loads from a file).
import type { StoredGraded } from "./graded_store.ts";
import type { GradedShelf } from "./types";
import type { DrainedBatch } from "./build_catalogue.ts";
export class StaticGradedStore implements GradedRunStore {
  private readonly rows: StoredGraded[];
  constructor(rows: StoredGraded[]) { this.rows = rows; }
  async saveGraded(_id: string, _g: GradedShelf, _label: string): Promise<void> { throw new Error("StaticGradedStore is read-only"); }
  async loadAll(): Promise<StoredGraded[]> { return structuredClone(this.rows).sort((a, b) => (a.cluster_id < b.cluster_id ? -1 : a.cluster_id > b.cluster_id ? 1 : 0)); }
}
// The f305 drained-batch file format -> stored records. graded_at comes from batch.graded_at[id] when present, else `now` (so a legacy batch with no
// timestamps is treated as graded this moment; the age limit only bites on records that carry a real graded_at). Shelves with no run are returned in `missing`.
export function storedFromDrainedBatch(batch: DrainedBatch & { graded_at?: Record<string, string> }, now: string): { rows: StoredGraded[]; missing: string[] } {
  const rows: StoredGraded[] = [], missing: string[] = [];
  for (const s of batch.shelves ?? []) {
    const run = Object.prototype.hasOwnProperty.call(batch.runs ?? {}, s.cluster_id) ? batch.runs[s.cluster_id] : null;
    if (!run) { missing.push(s.cluster_id); continue; }
    rows.push({ cluster_id: s.cluster_id, label: s.label, content_hash: run.content_hash, pass: run.pass, checks: run.checks, shelf: s.shelf as GradedShelf, graded_at: batch.graded_at?.[s.cluster_id] ?? now });
  }
  return { rows, missing };
}
