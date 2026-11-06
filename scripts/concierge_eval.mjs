// Evaluate the concierge on lib/concierge/questions.tsv. Dev = even rows, held-out test = odd rows (tune on dev only).
import fs from "node:fs";
import { readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
export const root = new URL("..", import.meta.url).pathname;
const R = (p) => import(pathToFileURL(root + p).href);
const { buildIndex, route } = await R("lib/concierge/router.ts");
const { PORTAL } = await R("lib/concierge/portal.ts");
const { shelfFromOffer } = await R("lib/concierge/offers.ts");
const offers = [];
for (const f of readdirSync(root + "lib/offers/data").filter((x) => x.endsWith(".ts"))) {
  const m = await R("lib/offers/data/" + f);
  for (const v of Object.values(m)) if (Array.isArray(v)) offers.push(...v);
}
export const shelves = [...PORTAL, ...offers.map(shelfFromOffer)];
export const index = buildIndex(shelves);
export const questions = fs.readFileSync(root + "lib/concierge/questions.tsv", "utf8").split("\n").filter(Boolean).map((l, i) => {
  const [seat, expect, q] = l.split("\t");
  return { i, seat, expect, q, split: i % 2 === 0 ? "dev" : "test" };
});
export function run() {
  return questions.map((x) => {
    const r = route(index, x.q, x.seat);
    const got = r.kind === "match" ? r.shelf.id : r.kind === "unmatched" ? "none" : "ask";
    const top3 = r.kind === "match" ? [r.shelf.id, ...r.alternatives.map((a) => a.shelfId)] : r.kind === "ask" ? r.taps.map((t) => t.shelfId) : ["none"];
    return { ...x, got, ok: got === x.expect, in3: top3.includes(x.expect) };
  });
}
if (process.argv[1] && process.argv[1].endsWith("concierge_eval.mjs")) {
  const res = run();
  for (const s of ["dev", "test", "all"]) {
    const set = res.filter((r) => s === "all" || r.split === s);
    console.log(s, set.filter((r) => r.ok).length + "/" + set.length, "top3", set.filter((r) => r.in3).length);
  }
  const show = process.argv[2] || "dev";
  for (const r of res.filter((r) => !r.ok && (show === "all" || r.split === show))) console.log("MISS", r.seat, "|", r.q, "| want", r.expect, "got", r.got);
}
