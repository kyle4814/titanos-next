// Guards the dev half: shape, labelled synthetic, ZERO overlap with the frozen holdout (exact, token-set and 5-word-run), 0 model calls.
import fs from "node:fs";
import { dev, runDev } from "./concierge_dev.mjs";
import { holdout, normalise } from "./concierge_holdout.mjs";
import { questions, shelves } from "./concierge_eval.mjs";
let pass = 0, fail = 0;
const t = (name, ok, d = "") => { if (ok) pass++; else { fail++; console.log("FAIL", name, d); } };
const key = (q) => normalise(q).replace(/\s+/g, " ").trim();
const tset = (q) => [...new Set(key(q).split(" "))].sort().join(" ");
export const runs = (q, n = 5) => { const w = key(q).split(" "), out = new Set(); for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" ")); return out; };
export function overlap(a, b) {
  const ek = new Set(b.map((x) => key(x.q))), ts = new Set(b.map((x) => tset(x.q))), rs = new Set(b.flatMap((x) => [...runs(x.q)]));
  return a.filter((x) => ek.has(key(x.q)) || ts.has(tset(x.q)) || [...runs(x.q)].some((r) => rs.has(r))).map((x) => x.q);
}
t("at least 120 dev asks", dev.length >= 120, String(dev.length));
t("all six seats present", ["guest", "owner", "pro", "agent", "enterprise", "partner"].every((s) => dev.some((x) => x.seat === s)));
const ids = new Set(shelves.map((s) => s.id));
t("every expected shelf id exists", dev.every((x) => ["none", "ask"].includes(x.expect) || ids.has(x.expect)), dev.filter((x) => !["none", "ask"].includes(x.expect) && !ids.has(x.expect)).map((x) => x.expect).join());
t("no blank or tab-split fields", fs.readFileSync(new URL("../lib/concierge/dev.tsv", import.meta.url), "utf8").split("\n").filter(Boolean).every((l) => l.split("\t").length === 3));
t("dev set is labelled synthetic in its header script", /SYNTHETIC/.test(fs.readFileSync(new URL("./concierge_dev.mjs", import.meta.url), "utf8")));
const o = overlap(dev, holdout);
t("ZERO overlap: no dev ask equals, token-set-matches or shares a 5-word run with a holdout ask", o.length === 0, o.join(" ; "));
const i = dev.filter((x) => new Set(questions.map((q) => key(q.q))).has(key(x.q)));
t("no dev ask duplicates a questions.tsv ask", i.length === 0, i.map((x) => x.q).join(" ; "));
t("mutant: a planted exact holdout copy is caught", overlap([...dev, { q: " " + holdout[0].q.toUpperCase() + "! " }], holdout).length >= 1);
t("mutant: a planted reordered holdout copy is caught", overlap([{ q: holdout[1].q.split(" ").reverse().join(" ") }], holdout).length >= 1);
t("mutant: a planted 5-word run from the holdout is caught", overlap([{ q: "zzz " + holdout.find((x) => key(x.q).split(" ").length >= 6).q.split(" ").slice(0, 5).join(" ") + " yyy" }], holdout).length >= 1);
t("no duplicate (seat + ask) within dev", new Set(dev.map((x) => x.seat + "|" + key(x.q))).size === dev.length);
const res = runDev();
t("every dev ask got a verdict", res.length === dev.length);
console.log(`concierge dev: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
