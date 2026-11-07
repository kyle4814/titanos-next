// F80 regression: the near-duplicate offer fixture and the twin guard. neardup.tsv was written from catalogue data without opening holdout.tsv.
import fs from "node:fs";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { index, shelves } from "./concierge_eval.mjs";
import { neardup, runNearDup } from "./concierge_neardup.mjs";
const root = new URL("..", import.meta.url).pathname;
const { normalise } = await import(pathToFileURL(root + "lib/concierge/text.ts").href);
const G = await import(pathToFileURL(root + "lib/concierge/askguard.ts").href);
let pass = 0, fail = 0;
const t = (name, ok, extra = "") => { if (ok) pass++; else { fail++; console.log("FAIL", name, extra); } };
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(root + "lib/concierge/" + f)).digest("hex");
const HOLDOUT_SHA = "a2882e79b1f1489689072b5ef25afe4878ec8df1a76bab00c291402a759cc623";
t("holdout.tsv byte-identical to the recorded sha256", sha("holdout.tsv") === HOLDOUT_SHA);

const pairs = new Map();
for (const r of neardup) { if (!pairs.has(r.pair)) pairs.set(r.pair, []); pairs.get(r.pair).push(r); }
t("at least 30 pairs", pairs.size >= 30, pairs.size);
t("every pair = 1 ambiguous ask + 2 clear asks, one per shelf, shelves distinct", [...pairs.values()].every((p) => p.length === 3 && p.filter((r) => r.expect === "ask").length === 1 && new Set(p.map((r) => r.expect)).size === 3));
const offerIds = new Set(shelves.filter((s) => s.kind === "offer").map((s) => s.id));
t("every clear label is a real offer shelf", neardup.filter((r) => r.expect !== "ask").every((r) => offerIds.has(r.expect)));
const norm = neardup.map((r) => normalise(r.q));
t("no internal duplicate", new Set(norm).size === norm.length);
let clash = 0;
for (const f of ["holdout.tsv", "questions.tsv", "questions_blind.tsv", "questions_blind2.tsv", "questions_wA69.tsv", "dev.tsv", "ask_dev.tsv"]) {
  const s = new Set(fs.readFileSync(root + "lib/concierge/" + f, "utf8").split("\n").filter(Boolean).map((l) => normalise(l.split("\t")[2])));
  clash += norm.filter((n) => s.has(n)).length;
}
t("no normalised clash with any other labelled set", clash === 0, clash);
t("fixture has no em or en dashes", !/[–—]/.test(fs.readFileSync(root + "lib/concierge/neardup.tsv", "utf8")));

const a = runNearDup(), b = runNearDup();
t("0 model, network or random calls", a.calls === 0);
t("deterministic (two runs identical)", JSON.stringify(a.res.map((r) => r.got)) === JSON.stringify(b.res.map((r) => r.got)));
t("raise recall floor: 15/34 or better (baseline before the twin guard was 8/34)", a.raised >= 15, `${a.raised}/${a.nAmb}`);
t("false-raise ceiling: 6/68 or fewer (the twin guard must not add false raises)", a.falseRaise <= 6, `${a.falseRaise}/${a.nClear}`);
t("clear asks right floor: 50/68", a.clearOk >= 50, `${a.clearOk}/${a.nClear}`);
// mutants: switch the guard off and the recall gain must disappear; make it fire on everything and false raises must rise.
const off = { jac: 0.15, ratio: 99 }, all = { jac: 0, ratio: 0 };
const probe = index.docs.length > 0;
t("index loaded", probe);
// the twin guard in isolation: an ask naming the top offer's own distinguishing words is NOT raised, an ask naming neither IS raised
const rank = (q) => index.docs.map((d) => ({ d, s: 0 }));
const mk = (id, s) => ({ d: index.docs.find((x) => x.shelf.id === id), s });
const top = mk("offer:solar-site-shortlist", 10), tw = mk("offer:solar-pipeline-desk", 9);
t("unit: twin within ratio, ask names nothing distinguishing -> raise", G.twinsToAsk(["solar", "installer"], [top, tw]).length === 1);
t("unit: ask names the top's own title word -> stands", G.twinsToAsk(["shortlist"], [top, tw]).length === 0);
t("unit: ask names the twin's word -> raise", G.twinsToAsk(["retainer"], [top, tw]).length === 1);
t("mutant: ratio 99 (guard off) never raises", G.twinsToAsk(["solar"], [top, tw], off).length === 0);
t("mutant: jac 0 ratio 0 raises on an unrelated pair too", G.twinsToAsk(["x"], [top, mk("offer:free-tender-digest", 1)], all).length === 1);
t("twin below the score ratio does not raise", G.twinsToAsk(["solar"], [top, mk("offer:solar-pipeline-desk", 5)]).length === 0);
t("a portal top pick is never twin-asked", G.twinsToAsk(["x"], [{ d: index.docs.find((x) => x.shelf.kind === "portal"), s: 10 }, tw]).length === 0);
console.log(`concierge neardup: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
