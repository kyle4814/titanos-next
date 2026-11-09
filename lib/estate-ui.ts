// /enterprise#estate view-model (plan chapter 6, chunk C8, f274). Pure: no network, no clock of its own, no scanning.
// Input rows follow the f30/f34 estate row shape (portal-api EstateRow): domain, grade, scannedAt (epoch ms), plus the
// owner entity (the row's `owner`, or the `group` the estate API already returns). Output is what the component draws.
export const GRADES = ["F", "D", "C", "B", "A"] as const;   // worst first: the sort order of the view
export type Grade = (typeof GRADES)[number] | "UNKNOWN";
export const CACHE_TTL_MS = 15 * 60_000;                    // mirrors estate_cache.ts default ttlMs (15 min)
export const METHOD_LINE = "Public DNS reads only, nothing is touched.";
export const SYNTHETIC_LABEL = "Example estate with made-up domains (not a real organisation)";
export const EMPTY_TEXT = "No domains in this estate yet. Add and verify a domain you own and it will appear here.";

export type EstateInput = { domain?: unknown; grade?: unknown; scannedAt?: unknown; owner?: unknown; group?: unknown };
export type EstateViewRow = { domain: string; grade: Grade; owner: string; scannedAt: number | null; stale: boolean; ageMinutes: number | null };
export type EstateErrorCode = "NOT_A_LIST" | "BAD_ROW" | "BAD_NOW";
export type EstateView =
  | { ok: true; empty: boolean; emptyText: string; rows: EstateViewRow[]; summary: Record<Grade, number> & { total: number; stale: number }; method: string }
  | { ok: false; code: EstateErrorCode; message: string };

const err = (code: EstateErrorCode, message: string): EstateView => ({ ok: false, code, message });
const rank = (g: Grade) => (g === "UNKNOWN" ? GRADES.length : GRADES.indexOf(g));

export function buildEstateView(input: unknown, nowMs: number, ttlMs: number = CACHE_TTL_MS): EstateView {
  if (typeof nowMs !== "number" || !Number.isFinite(nowMs)) return err("BAD_NOW", "The view needs a valid current time to work out which scans are out of date.");
  if (!Array.isArray(input)) return err("NOT_A_LIST", "The estate must be a list of domains. Nothing was shown.");
  const rows: EstateViewRow[] = [];
  for (let i = 0; i < input.length; i++) {
    const r = input[i] as EstateInput | null;
    const bad = (why: string) => err("BAD_ROW", `Row ${i + 1} could not be read: ${why}. Nothing was shown.`);
    if (r === null || typeof r !== "object" || Array.isArray(r)) return bad("it is not a domain record");
    if (typeof r.domain !== "string" || !r.domain.trim()) return bad("the domain is missing");
    const g = r.grade === null || r.grade === undefined ? "UNKNOWN" : r.grade;
    if (g !== "UNKNOWN" && !(typeof g === "string" && (GRADES as readonly string[]).includes(g))) return bad("the grade is not A to F");
    const ownerRaw = r.owner ?? r.group;
    if (ownerRaw !== undefined && ownerRaw !== null && typeof ownerRaw !== "string") return bad("the owner is not text");
    const sa = r.scannedAt;
    if (sa !== null && sa !== undefined && (typeof sa !== "number" || !Number.isFinite(sa) || sa < 0)) return bad("the scan time is not a valid time");
    const scannedAt = typeof sa === "number" ? sa : null;
    const age = scannedAt === null ? null : nowMs - scannedAt;
    // Stale = strictly older than the cache TTL (exactly the TTL is still fresh). Never scanned counts as stale.
    const stale = age === null ? true : age > ttlMs;
    rows.push({
      domain: r.domain.trim().toLowerCase(), grade: g as Grade,
      owner: typeof ownerRaw === "string" && ownerRaw.trim() ? ownerRaw.trim() : "Unassigned",
      scannedAt, stale, ageMinutes: age === null ? null : Math.max(0, Math.floor(age / 60_000)),
    });
  }
  rows.sort((a, b) => rank(a.grade) - rank(b.grade) || a.domain.localeCompare(b.domain));
  const summary = { F: 0, D: 0, C: 0, B: 0, A: 0, UNKNOWN: 0, total: rows.length, stale: 0 } as Record<Grade, number> & { total: number; stale: number };
  for (const r of rows) { summary[r.grade]++; if (r.stale) summary.stale++; }
  return { ok: true, empty: rows.length === 0, emptyText: EMPTY_TEXT, rows, summary, method: METHOD_LINE };
}

// Synthetic example (clearly labelled in the UI). Fixed clock so server and client render the same thing.
export const SAMPLE_NOW = Date.UTC(2026, 10, 7, 0, 0, 0);
export const SAMPLE_ESTATE: EstateInput[] = [
  { domain: "shop.example.invalid", grade: "B", scannedAt: SAMPLE_NOW - 3 * 60_000, owner: "Example Retail Pty Ltd" },
  { domain: "www.example.invalid", grade: "A", scannedAt: SAMPLE_NOW - 5 * 60_000, owner: "Example Holdings" },
  { domain: "old-brand.example.invalid", grade: "F", scannedAt: SAMPLE_NOW - 40 * 60_000, owner: "Example Holdings" },
  { domain: "mail.example.invalid", grade: "C", scannedAt: SAMPLE_NOW - 9 * 60_000, owner: "Example Retail Pty Ltd" },
  { domain: "new-site.example.invalid", grade: null, scannedAt: null, owner: "Example Holdings" },
];
