// C6 raw ask-log dump (f396). Emits one JSON line per holdout ask with the router's RAW verdict only
// (kind, shelf, alternatives, taps). It does NOT score anything and does NOT import concierge_holdout.mjs,
// so the independent verifier (c6_holdout_verify.py) recomputes every score from this log itself.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { index } from "./concierge_eval.mjs";
const root = new URL("..", import.meta.url).pathname;
const { route } = await import(pathToFileURL(root + "lib/concierge/router.ts").href);
const rows = fs.readFileSync(root + "lib/concierge/holdout.tsv", "utf8").split("\n").filter(Boolean);
for (const l of rows) {
  const [seat, expect, q] = l.split("\t");
  const r = route(index, q, seat);
  console.log(JSON.stringify({
    seat, expect, q, kind: r.kind,
    shelf: r.kind === "match" ? r.shelf.id : null,
    alts: r.kind === "match" ? r.alternatives.map((a) => a.shelfId) : [],
    taps: r.kind === "ask" ? r.taps.map((t) => t.shelfId) : [],
  }));
}
