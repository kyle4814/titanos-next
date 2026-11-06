// C6 concierge miss taxonomy (f72). MEASURE ONLY: runs the router over lib/concierge/holdout.tsv and dev.tsv READ-ONLY and describes WHY it misses.
// It never writes either file, never changes the router, and its output must NOT be used to tune rules against holdout rows (dev.tsv is synthetic).
// Pair diagnosis is STRUCTURAL (shelf keywords and titles only); no holdout ask text is printed. 0 model/network/random calls.
import { pathToFileURL } from "node:url";
import { shelves } from "./concierge_eval.mjs";
import { holdout, runHoldout } from "./concierge_holdout.mjs";
import { runDev } from "./concierge_dev.mjs";
const root = new URL("..", import.meta.url).pathname;
const { tokens } = await import(pathToFileURL(root + "lib/concierge/text.ts").href);
const byId = new Map(shelves.map((s) => [s.id, s]));
const isShelf = (id) => id !== "none" && id !== "ask";

export const CAUSES = ["wrong shelf", "off-topic matched", "ask not raised", "unmatched", "ask raised on a clear ask"];
export function causeOf(r) {
  if (r.ok) return null;
  if (r.expect === "none") return "off-topic matched";          // expected out of scope, router matched or asked
  if (r.expect === "ask") return "ask not raised";              // expected an ask, router matched a shelf or said none
  if (r.got === "none") return "unmatched";                     // a shelf was expected, router found nothing
  if (r.got === "ask") return "ask raised on a clear ask";      // a shelf was expected, router asked instead
  return "wrong shelf";                                         // a shelf was expected, a different shelf returned
}
export function analyse(rows) {
  const matrix = {}, causes = Object.fromEntries(CAUSES.map((c) => [c, 0])), pairCount = {};
  for (const r of rows) {
    (matrix[r.expect] ||= {})[r.got] = (matrix[r.expect][r.got] || 0) + 1;
    const c = causeOf(r); if (c) causes[c]++;
    if (!r.ok && isShelf(r.expect) && isShelf(r.got)) { const k = r.expect + " -> " + r.got; pairCount[k] = (pairCount[k] || 0) + 1; }
  }
  const pairs = Object.entries(pairCount).map(([k, n]) => { const [expected, returned] = k.split(" -> "); return { expected, returned, n }; })
    .sort((a, b) => b.n - a.n || (a.expected + a.returned < b.expected + b.returned ? -1 : 1));
  const off = Object.entries(matrix).flatMap(([e, row]) => Object.entries(row).filter(([g]) => g !== e).map(([g, n]) => n)).reduce((a, b) => a + b, 0);
  return { n: rows.length, right: rows.filter((r) => r.ok).length, misses: rows.filter((r) => !r.ok).length, matrix, causes, pairs, offDiagonal: off };
}
const kwTokens = (s) => new Set(s.keywords.flatMap((k) => tokens(k)));
function diagnose(p) {
  const a = byId.get(p.expected), b = byId.get(p.returned);
  if (!a || !b) return { ...p, diagnosis: "shelf missing from catalogue", recommendation: "none" };
  const ta = new Set(tokens(a.title)), tb = new Set(tokens(b.title)), ka = kwTokens(a), kb = kwTokens(b);
  const titleShared = [...ta].filter((t) => tb.has(t)), kwShared = [...ka].filter((t) => kb.has(t)).sort();
  const union = new Set([...ka, ...kb]), jac = union.size ? kwShared.length / union.size : 0;
  const kinds = a.kind === b.kind ? a.kind + "/" + b.kind : a.kind + " vs " + b.kind;
  let diagnosis = `expected "${a.title}" (${a.id}, ${a.kind}), returned "${b.title}" (${b.id}, ${b.kind}). Shared keyword tokens ${kwShared.length} of ${union.size} (Jaccard ${jac.toFixed(2)}): ${kwShared.slice(0, 12).join(", ") || "none"}. Shared title tokens: ${titleShared.join(", ") || "none"}. Keyword counts ${a.keywords.length} vs ${b.keywords.length}.`;
  let rec;
  if (a.kind !== b.kind) rec = `DESIGN ONLY: a cross-kind confusion (${kinds}): the returned ${b.kind} shelf's vocabulary beats the expected ${a.kind} shelf on plain-language asks. Consider whether the expected shelf needs paraphrase coverage written from a NEW fresh dev half, never from holdout rows.`;
  else if (titleShared.length || jac >= 0.15) rec = `DESIGN ONLY: the two shelves overlap in vocabulary. Consider a disambiguating "ask" tap for this pair (offer both) or sharpening which keywords are unique to each, validated on a new fresh dev half.`;
  else rec = `DESIGN ONLY: little structural overlap, so the confusion is likely generic words in the ask (not shelf vocabulary). Consider collecting real asks (f45 log scorer) for this pair before changing anything.`;
  return { ...p, diagnosis, recommendation: rec };
}
export function taxonomy() {
  const h = runHoldout().res, d = runDev();
  const H = analyse(h), D = analyse(d);
  return { holdout: { ...H, top10: H.pairs.slice(0, 10), top5: H.pairs.slice(0, 5).map(diagnose) }, dev: { ...D, top10: D.pairs.slice(0, 10), top5: D.pairs.slice(0, 5).map(diagnose) },
    note: "MEASURE ONLY. No router tuning. Dev is SYNTHETIC. The 80% kill test is NOT claimed." };
}
export const holdoutRows = holdout.length;
if (process.argv[1] && process.argv[1].split("/").pop() === "concierge_miss_taxonomy.mjs") {
  const t = taxonomy();
  if (process.argv.includes("--json")) console.log(JSON.stringify(t, null, 1));
  else {
  for (const [name, s] of [["HOLDOUT (frozen, 120)", t.holdout], ["DEV (synthetic)", t.dev]]) {
    console.log(`== ${name}: right ${s.right}/${s.n} = ${(100 * s.right / s.n).toFixed(1)}%, misses ${s.misses}`);
    console.log("causes:", JSON.stringify(s.causes));
    console.log("top 10 confusable shelf pairs (expected -> returned):");
    for (const p of s.top10) console.log(`  ${p.n}  ${p.expected} -> ${p.returned}`);
    console.log("diagnoses of the top 5:");
    for (const p of s.top5) console.log(`  [${p.n}] ${p.expected} -> ${p.returned}\n    ${p.diagnosis}\n    ${p.recommendation}`);
    console.log("confusion matrix (expected: returned=count):");
    for (const e of Object.keys(s.matrix).sort()) console.log(`  ${e}: ` + Object.keys(s.matrix[e]).sort().map((g) => `${g}=${s.matrix[e][g]}`).join(" "));
  }
  console.log(t.note);
  }
}
