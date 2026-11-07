// Honest holdout for the C6 concierge. lib/concierge/holdout.tsv was written BEFORE the router or questions.tsv were read,
// and the router is NOT tuned on it. Scores: right shelf, top-3, correct-unmatched, correct-ask. Wilson 95% interval. 0 model calls trapped.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { index, run as runInSample } from "./concierge_eval.mjs";
const root = new URL("..", import.meta.url).pathname;
const { route } = await import(pathToFileURL(root + "lib/concierge/router.ts").href);
const { normalise } = await import(pathToFileURL(root + "lib/concierge/text.ts").href);
export { normalise };
export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - m) / d, (c + m) / d];
}
export const holdout = fs.readFileSync(root + "lib/concierge/holdout.tsv", "utf8").split("\n").filter(Boolean).map((l, i) => {
  const [seat, expect, q] = l.split("\t");
  return { i, seat, expect, q };
});
export function runHoldout() {
  const realFetch = globalThis.fetch, realRandom = Math.random;
  let calls = 0;
  globalThis.fetch = () => { calls++; throw new Error("network forbidden"); };
  Math.random = () => { calls++; return 0.5; };
  let res;
  try {
    res = holdout.map((x) => {
      const r = route(index, x.q, x.seat);
      const got = r.kind === "match" ? r.shelf.id : r.kind === "unmatched" ? "none" : "ask";
      const top3 = r.kind === "match" ? [r.shelf.id, ...r.alternatives.map((a) => a.shelfId)] : r.kind === "ask" ? r.taps.map((t) => t.shelfId) : ["none"];
      return { ...x, got, ok: got === x.expect, in3: top3.includes(x.expect) };
    });
  } finally { globalThis.fetch = realFetch; Math.random = realRandom; }
  return { res, calls };
}
const pct = (k, n) => (100 * k / n).toFixed(1) + "%";
const ci = (k, n) => { const [a, b] = wilson(k, n); return `[${(100 * a).toFixed(1)}%, ${(100 * b).toFixed(1)}%]`; };
if (process.argv[1] && process.argv[1].split("/").pop() === "concierge_holdout.mjs") {
  const { res, calls } = runHoldout();
  const n = res.length, ok = res.filter((r) => r.ok).length, in3 = res.filter((r) => r.in3).length;
  const grp = (f) => res.filter(f);
  const none = grp((r) => r.expect === "none"), ask = grp((r) => r.expect === "ask"), shelf = grp((r) => r.expect !== "none" && r.expect !== "ask");
  console.log(`HOLDOUT n=${n} model/network/random calls=${calls}`);
  console.log(`overall right: ${ok}/${n} = ${pct(ok, n)} Wilson95 ${ci(ok, n)}  top3: ${in3}/${n} = ${pct(in3, n)} ${ci(in3, n)}`);
  const sh = shelf.filter((r) => r.ok).length;
  console.log(`shelf asks right: ${sh}/${shelf.length} = ${pct(sh, shelf.length)} ${ci(sh, shelf.length)}  top3: ${shelf.filter((r) => r.in3).length}/${shelf.length}`);
  const nn = none.filter((r) => r.ok).length, aa = ask.filter((r) => r.ok).length;
  console.log(`out-of-scope kept unmatched: ${nn}/${none.length} ${ci(nn, none.length)}   near-duplicate -> ask: ${aa}/${ask.length} ${ci(aa, ask.length)}`);
  for (const s of ["guest", "owner", "pro", "agent", "enterprise", "partner"]) { const g = grp((r) => r.seat === s); console.log(`  seat ${s}: ${g.filter((r) => r.ok).length}/${g.length}`); }
  const ins = runInSample(), ik = ins.filter((r) => r.ok).length, [lo, hi] = wilson(ik, ins.length), [, hh] = wilson(ok, n);
  const gap = 100 * (ik / ins.length - ok / n);
  console.log(`IN-SAMPLE (questions.tsv): ${ik}/${ins.length} = ${pct(ik, ins.length)} ${ci(ik, ins.length)}`);
  console.log(`GAP in-sample minus holdout: ${gap.toFixed(1)} points (intervals ${hh >= lo ? "overlap" : "disjoint"}: holdout hi ${(100*hh).toFixed(1)} vs in-sample lo ${(100*lo).toFixed(1)})`);
  console.log("UNKNOWN: real-visitor accuracy still needs live asks (f45 scorer).");
  for (const r of res.filter((r) => !r.ok)) console.log("MISS", r.seat, "|", r.q, "| want", r.expect, "got", r.got, r.in3 ? "(in top3)" : "");
}
