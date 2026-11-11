// Fresh dev split (dev3) for the C6 ask-ambiguity router: SYNTHETIC asks (lib/concierge/dev3.tsv, f434 lane, not real visitors),
// written from the catalogue only, WITHOUT opening holdout.tsv. This is the ONLY set the ask-margin rule is tuned on. 0 model calls.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { index } from "./concierge_eval.mjs";
import { wilson } from "./concierge_holdout.mjs";
const root = new URL("..", import.meta.url).pathname;
const { route } = await import(pathToFileURL(root + "lib/concierge/router.ts").href);
export const dev3 = fs.readFileSync(root + "lib/concierge/dev3.tsv", "utf8").split("\n").filter(Boolean).map((l, i) => { const [seat, expect, q] = l.split("\t"); return { i, seat, expect, q }; });
export function classOf(x) { return x.expect === "ask" ? "ask" : x.expect === "none" ? "none" : x.expect.startsWith("offer:") ? "offer" : "portal"; }
export function runDev3(r0 = route) {
  return dev3.map((x) => {
    const r = r0(index, x.q, x.seat);
    const got = r.kind === "match" ? r.shelf.id : r.kind === "unmatched" ? "none" : "ask";
    const top3 = r.kind === "match" ? [r.shelf.id, ...r.alternatives.map((a) => a.shelfId)] : r.kind === "ask" ? r.taps.map((t) => t.shelfId) : ["none"];
    return { ...x, cls: classOf(x), got, ok: got === x.expect, in3: top3.includes(x.expect) };
  });
}
export function summary(res = runDev3()) {
  const ok = res.filter((r) => r.ok).length;
  const by = {};
  for (const c of ["ask", "none", "offer", "portal"]) { const g = res.filter((r) => r.cls === c); by[c] = { n: g.length, ok: g.filter((r) => r.ok).length }; }
  const miss = res.filter((r) => !r.ok);
  const kinds = { "ask not raised": 0, "wrong shelf": 0, "off-topic matched": 0, "ask on clear": 0, "other": 0 };
  for (const m of miss) {
    if (m.expect === "ask") kinds["ask not raised"]++;
    else if (m.expect === "none") kinds["off-topic matched"]++;
    else if (m.got === "ask") kinds["ask on clear"]++;
    else if (m.got === "none") kinds["other"]++;
    else kinds["wrong shelf"]++;
  }
  return { n: res.length, ok, w: wilson(ok, res.length), by, miss, kinds };
}
if (process.argv[1] && process.argv[1].split("/").pop() === "concierge_dev3.mjs") {
  const s = summary();
  console.log(`DEV3 (synthetic) n=${s.n} right ${s.ok} = ${(100 * s.ok / s.n).toFixed(1)}%  wilson95 ${JSON.stringify(s.w)}`);
  console.log("BY CLASS", JSON.stringify(s.by));
  console.log("MISS KINDS", JSON.stringify(s.kinds));
  if (process.argv.includes("--miss")) for (const r of s.miss) console.log("MISS", r.seat, "|", r.q, "| want", r.expect, "got", r.got);
}
