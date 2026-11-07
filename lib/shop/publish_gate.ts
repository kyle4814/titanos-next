// C5 hop 4 (plan ch.6 C5, line 1497): the publish gate. A drained shelf enters the live catalogue only when a FRESH grader run
// (taken against the shelf's own content hash) shows every required check passing and the label is present.
// Pure: no model call, no network, no clock, no D1. Never mutates its inputs. Wiring to a scheduler or deploy is PENDING LIVE.
import { createHash } from "node:crypto";
import type { Shelf, GradedShelf, Check } from "./types";

// Every check gradeShelf emits for a well-shaped shelf. A run missing one of these is partial and the shelf is held.
export const REQUIRED_CHECKS = [
  "types", "no-unknown-fields", "price-type", "slug", "name", "bluf", "source", "copy", "not-synthetic", "price-honest", "availability-true", "content",
] as const;

export type GradeRun = { content_hash: string; pass: boolean; checks: Check[] };
export interface GraderPort { lookup(cluster_id: string): GradeRun | null | undefined }
export type DrainedShelf = { cluster_id: string; label: string; shelf: Shelf | GradedShelf };
export type CatalogueEntry = { cluster_id: string; label: string; content_hash: string; shelf: GradedShelf };
export type Catalogue = { entries: CatalogueEntry[] };
export type Held = { cluster_id: string; reason: string };
export type PromoteResult = { published: CatalogueEntry[]; held: Held[]; already: string[]; catalogue: Catalogue };

const canon = (v: unknown): string => {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return "{" + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canon(o[k])).join(",") + "}";
  }
  return JSON.stringify(v) ?? "null";
};
// Hash of the shelf's own content. The attached grade is a result, not content, so it is excluded.
export function contentHash(shelf: Shelf | GradedShelf): string {
  const { grade: _g, ...rest } = shelf as GradedShelf;
  return createHash("sha256").update(canon(rest)).digest("hex");
}
// Build the run a grader port stores after grading: bound to the exact content that was graded.
export function runFromGraded(g: GradedShelf): GradeRun {
  return { content_hash: contentHash(g), pass: g.grade.pass, checks: g.grade.checks.map((c) => ({ ...c })) };
}
// Adapter: a grader port backed by a plain map of cluster_id -> run (what a queue/D1 row would hold).
export class MemoryGraderPort implements GraderPort {
  runs: Record<string, GradeRun>;
  constructor(runs: Record<string, GradeRun> = {}) { this.runs = runs; }
  lookup(id: string) { return Object.prototype.hasOwnProperty.call(this.runs, id) ? this.runs[id] : null; }
}

const nonEmpty = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;
// Returns a reason the run does not clear the bar, or null when it does.
export function runProblem(run: GradeRun | null | undefined, hash: string): string | null {
  if (!run || typeof run !== "object") return "ungraded: no grader run";
  if (run.content_hash !== hash) return "stale grade: shelf content changed after grading";
  if (!Array.isArray(run.checks) || run.checks.length === 0) return "ungraded: grader run has no checks";
  const ids = new Set(run.checks.map((c) => c && c.id));
  const missing = REQUIRED_CHECKS.filter((id) => !ids.has(id));
  if (missing.length) return "partial grade: missing checks " + missing.join(",");
  const bad = run.checks.filter((c) => !c || c.ok !== true).map((c) => c?.id ?? "?");
  if (bad.length) return "failed checks: " + bad.join(",");
  if (run.pass !== true) return "grader run not marked pass";
  return null;
}

export function promoteDrained(catalogue: Catalogue, drained: DrainedShelf[], port: GraderPort): PromoteResult {
  const current = new Map<string, CatalogueEntry>();
  for (const e of catalogue?.entries ?? []) current.set(e.cluster_id, e);
  const input = Array.isArray(drained) ? drained : [];
  const counts = new Map<string, number>();
  for (const d of input) if (d) counts.set(d.cluster_id, (counts.get(d.cluster_id) ?? 0) + 1);
  const published: CatalogueEntry[] = [], held: Held[] = [], already: string[] = [];
  const next = new Map(current);
  for (const d of input) {
    if (!d || !nonEmpty(d.cluster_id) || !d.shelf) { held.push({ cluster_id: String(d?.cluster_id ?? ""), reason: "malformed drained shelf" }); continue; }
    const id = d.cluster_id;
    if ((counts.get(id) ?? 0) > 1) { held.push({ cluster_id: id, reason: "duplicate cluster id in drained batch" }); continue; }
    if (!nonEmpty(d.label)) { held.push({ cluster_id: id, reason: "missing label" }); continue; }
    const hash = contentHash(d.shelf);
    const problem = runProblem(port.lookup(id), hash);
    if (problem) { held.push({ cluster_id: id, reason: problem }); continue; }
    const have = current.get(id);
    if (have && have.content_hash === hash && have.label === d.label) { already.push(id); continue; }
    const run = port.lookup(id) as GradeRun;
    const entry: CatalogueEntry = {
      cluster_id: id, label: d.label, content_hash: hash,
      shelf: structuredClone({ ...(d.shelf as Shelf), grade: { pass: true, checks: run.checks } }) as GradedShelf,
    };
    next.set(id, entry);
    published.push(entry);
  }
  return { published, held, already, catalogue: { entries: [...next.values()] } };
}

// Throws listing EVERY entry that is ungraded, failing, hash-mismatched, or unlabelled. Silent only when the catalogue is clean.
export function assertCatalogueAllGraded(catalogue: Catalogue): void {
  const bad: string[] = [];
  for (const e of catalogue?.entries ?? []) {
    const id = e?.cluster_id ?? "?";
    if (!e || !e.shelf) { bad.push(id + ": no shelf"); continue; }
    if (!nonEmpty(e.label)) bad.push(id + ": missing label");
    const g = (e.shelf as GradedShelf).grade;
    const run: GradeRun | null = g ? { content_hash: contentHash(e.shelf), pass: g.pass, checks: g.checks } : null;
    if (e.content_hash !== contentHash(e.shelf)) { bad.push(id + ": hash mismatch (edited after grading)"); continue; }
    const p = runProblem(run, e.content_hash);
    if (p) bad.push(id + ": " + p);
  }
  if (bad.length) throw new Error(`catalogue has ${bad.length} ungraded or mismatched shelf(s): ` + bad.join("; "));
}
