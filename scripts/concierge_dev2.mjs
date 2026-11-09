// Fresh offer dev half (dev2) for the C6 concierge: SYNTHETIC offer asks (lib/concierge/dev2.tsv, f79 lane, not real visitors),
// written WITHOUT opening holdout.tsv. Measure only: no router, offer or holdout change. 0 model calls.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { index } from "./concierge_eval.mjs";
import { wilson } from "./concierge_holdout.mjs";
const root = new URL("..", import.meta.url).pathname;
const { route } = await import(pathToFileURL(root + "lib/concierge/router.ts").href);
export const dev2 = fs.readFileSync(root + "lib/concierge/dev2.tsv", "utf8").split("\n").filter(Boolean).map((l, i) => { const [seat, expect, q] = l.split("\t"); return { i, seat, expect, q }; });
export function runDev2() {
  return dev2.map((x) => {
    const r = route(index, x.q, x.seat);
    const got = r.kind === "match" ? r.shelf.id : r.kind === "unmatched" ? "none" : "ask";
    const top3 = r.kind === "match" ? [r.shelf.id, ...r.alternatives.map((a) => a.shelfId)] : r.kind === "ask" ? r.taps.map((t) => t.shelfId) : ["none"];
    return { ...x, got, ok: got === x.expect, in3: top3.includes(x.expect) };
  });
}
export function summary(res = runDev2()) {
  const ok = res.filter((r) => r.ok).length, w = wilson(ok, res.length);
  const miss = res.filter((r) => !r.ok);
  const pairs = {};
  for (const m of miss) { const k = m.expect + " -> " + m.got; (pairs[k] ||= []).push(m); }
  return { n: res.length, ok, w, miss, pairs, in3: res.filter((r) => r.in3).length };
}
if (process.argv[1] && process.argv[1].split("/").pop() === "concierge_dev2.mjs") {
  const s = summary();
  console.log(`DEV2 (synthetic offer asks) n=${s.n} right ${s.ok} = ${(100 * s.ok / s.n).toFixed(1)}%  wilson95 ${JSON.stringify(s.w)}  top3 ${s.in3}`);
  for (const r of s.miss) console.log("MISS", r.seat, "|", r.q, "| want", r.expect, "got", r.got);
}
export function classes(miss) {
  const c = { "offer->portal": 0, "offer->offer": 0, "offer->ask": 0, "offer->none": 0 };
  for (const m of miss) c[m.got.startsWith("portal:") ? "offer->portal" : m.got.startsWith("offer:") ? "offer->offer" : m.got === "ask" ? "offer->ask" : "offer->none"]++;
  return c;
}
if (process.argv[1] && process.argv[1].split("/").pop() === "concierge_dev2.mjs") {
  const s = summary(), c = classes(s.miss), g = {};
  for (const m of s.miss) (g[m.got] ||= []).push(m.expect.replace("offer:", ""));
  console.log("CLASSES", JSON.stringify(c));
  console.log("TOP RETURNED-INSTEAD (by returned shelf):");
  for (const [k, v] of Object.entries(g).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).slice(0, 10)) console.log(" ", v.length, k, "<-", v.join(", "));
}
