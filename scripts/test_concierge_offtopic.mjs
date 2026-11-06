// Guards the F-66 off-topic guard: synthetic set shape and labelling, ZERO overlap with holdout.tsv, dev.tsv and questions.tsv,
// floors on the guard's effect, no regression on questions.tsv (177/200), cue words never shelf vocabulary. 0 model calls.
// This file never prints or opens holdout asks except through the shared loader used by the overlap check.
import fs from "node:fs";
import { offtopic, runOfftopic } from "./concierge_offtopic.mjs";
import { holdout, normalise } from "./concierge_holdout.mjs";
import { dev } from "./concierge_dev.mjs";
import { questions, shelves, index, run } from "./concierge_eval.mjs";
import { OFFTOPIC_CUES } from "../lib/concierge/offtopic.ts";
let pass = 0, fail = 0;
const t = (name, ok, d = "") => { if (ok) pass++; else { fail++; console.log("FAIL", name, d); } };
const key = (q) => normalise(q).replace(/\s+/g, " ").trim();
const tset = (q) => [...new Set(key(q).split(" "))].sort().join(" ");
const runs = (q, n = 5) => { const w = key(q).split(" "), out = new Set(); for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" ")); return out; };
function overlap(a, b) {
  const ek = new Set(b.map((x) => key(x.q))), ts = new Set(b.map((x) => tset(x.q))), rs = new Set(b.flatMap((x) => [...runs(x.q)]));
  return a.filter((x) => ek.has(key(x.q)) || ts.has(tset(x.q)) || [...runs(x.q)].some((r) => rs.has(r))).map((x) => x.q);
}
const off = offtopic.filter((x) => x.expect === "none"), gen = offtopic.filter((x) => x.expect !== "none");
t("at least 40 off-topic asks", off.length >= 40, String(off.length));
t("at least 20 genuine short asks", gen.length >= 20, String(gen.length));
t("genuine asks are short (6 words or fewer)", gen.every((x) => x.q.split(" ").length <= 6));
const ids = new Set(shelves.map((s) => s.id));
t("every genuine expected shelf id exists", gen.every((x) => ids.has(x.expect)), gen.filter((x) => !ids.has(x.expect)).map((x) => x.expect).join());
t("at least four seats present", new Set(offtopic.map((x) => x.seat)).size >= 4);
t("no blank or tab-split fields", fs.readFileSync(new URL("../lib/concierge/offtopic_dev.tsv", import.meta.url), "utf8").split("\n").filter(Boolean).every((l) => l.split("\t").length === 3));
t("set is labelled synthetic in its script header", /SYNTHETIC/.test(fs.readFileSync(new URL("./concierge_offtopic.mjs", import.meta.url), "utf8")));
t("ZERO overlap with holdout (exact, token-set, 5-word run)", overlap(offtopic, holdout).length === 0, overlap(offtopic, holdout).join(" ; "));
t("ZERO overlap with dev.tsv", overlap(offtopic, dev).length === 0, overlap(offtopic, dev).join(" ; "));
t("ZERO overlap with questions.tsv", overlap(offtopic, questions).length === 0, overlap(offtopic, questions).join(" ; "));
t("mutant: a planted holdout copy is caught", overlap([{ q: " " + holdout[0].q.toUpperCase() + "! " }], holdout).length >= 1);
t("mutant: a planted dev copy is caught", overlap([{ q: dev[0].q }], dev).length >= 1);
t("no duplicate (seat + ask)", new Set(offtopic.map((x) => x.seat + "|" + key(x.q))).size === offtopic.length);
const res = runOfftopic(), offOk = res.filter((r) => r.expect === "none" && r.ok).length, genOk = res.filter((r) => r.expect !== "none" && r.ok).length;
t("guard floor: off-topic kept unmatched >= 36 of the set (measured: 19 before the guard, 36 after)", offOk >= 36, `${offOk}/${off.length}`);
t("genuine short asks all still matched (23 of 23, same as before the guard)", genOk >= 23, `${genOk}/${gen.length}`);
const q = run().filter((r) => r.ok).length;
t("no regression on questions.tsv: 177/200 or better", q >= 177, String(q));
const bad = [...OFFTOPIC_CUES].filter((c) => index.idf.has(c));
t("no off-topic cue word appears anywhere in the shelf vocabulary (title, keywords, text)", bad.length === 0, bad.join(" "));
t("cue list is not empty", OFFTOPIC_CUES.size >= 60, String(OFFTOPIC_CUES.size));
console.log(`concierge offtopic: ${pass} passed, ${fail} failed (off-topic ${offOk}/${off.length}, genuine ${genOk}/${gen.length}, questions ${q}/200)`);
process.exit(fail ? 1 : 0);
