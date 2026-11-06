// Dev half for the C6 concierge: SYNTHETIC asks (lib/concierge/dev.tsv, written by the f65 lane, not real visitors) used to tune the router.
// holdout.tsv stays frozen. 0 model calls.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { index } from "./concierge_eval.mjs";
const root = new URL("..", import.meta.url).pathname;
const { route } = await import(pathToFileURL(root + "lib/concierge/router.ts").href);
export const dev = fs.readFileSync(root + "lib/concierge/dev.tsv", "utf8").split("\n").filter(Boolean).map((l, i) => { const [seat, expect, q] = l.split("\t"); return { i, seat, expect, q }; });
export function runDev() {
  return dev.map((x) => {
    const r = route(index, x.q, x.seat);
    const got = r.kind === "match" ? r.shelf.id : r.kind === "unmatched" ? "none" : "ask";
    const top3 = r.kind === "match" ? [r.shelf.id, ...r.alternatives.map((a) => a.shelfId)] : r.kind === "ask" ? r.taps.map((t) => t.shelfId) : ["none"];
    return { ...x, got, ok: got === x.expect, in3: top3.includes(x.expect) };
  });
}
if (process.argv[1] && process.argv[1].split("/").pop() === "concierge_dev.mjs") {
  const res = runDev(), ok = res.filter((r) => r.ok).length;
  console.log(`DEV (synthetic) n=${res.length} right ${ok} = ${(100 * ok / res.length).toFixed(1)}%  top3 ${res.filter((r) => r.in3).length}`);
  for (const r of res.filter((r) => !r.ok)) console.log("MISS", r.seat, "|", r.q, "| want", r.expect, "got", r.got);
}
