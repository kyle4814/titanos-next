// Off-topic guard set for the C6 concierge: SYNTHETIC asks (lib/concierge/offtopic_dev.tsv, hand-written by the f66 lane, not real visitors).
// expect "none" = an out-of-scope ask that must stay unmatched; any other expect = a genuine short ask that must still match that shelf.
// holdout.tsv is never opened by this file. 0 model calls.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { index } from "./concierge_eval.mjs";
const root = new URL("..", import.meta.url).pathname;
const { route } = await import(pathToFileURL(root + "lib/concierge/router.ts").href);
export const offtopic = fs.readFileSync(root + "lib/concierge/offtopic_dev.tsv", "utf8").split("\n").filter(Boolean).map((l, i) => { const [seat, expect, q] = l.split("\t"); return { i, seat, expect, q }; });
export function runOfftopic() {
  return offtopic.map((x) => {
    const r = route(index, x.q, x.seat);
    const got = r.kind === "match" ? r.shelf.id : r.kind === "unmatched" ? "none" : "ask";
    return { ...x, got, ok: got === x.expect };
  });
}
if (process.argv[1] && process.argv[1].split("/").pop() === "concierge_offtopic.mjs") {
  const res = runOfftopic(), off = res.filter((r) => r.expect === "none"), gen = res.filter((r) => r.expect !== "none");
  console.log(`OFFTOPIC (synthetic) off-topic kept unmatched ${off.filter((r) => r.ok).length}/${off.length}  genuine still matched ${gen.filter((r) => r.ok).length}/${gen.length}`);
  for (const r of res.filter((r) => !r.ok)) console.log("MISS", r.seat, "|", r.q, "| want", r.expect, "got", r.got);
}
