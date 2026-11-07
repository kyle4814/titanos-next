// Guards the honest holdout: shape, no overlap with the in-sample set, 0 model calls. Does NOT assert an accuracy floor (the holdout is a measurement, not a gate).
import fs from "node:fs";
import { holdout, runHoldout, wilson, normalise } from "./concierge_holdout.mjs";
import { questions, shelves } from "./concierge_eval.mjs";
let pass = 0, fail = 0;
const t = (name, ok, d = "") => { if (ok) pass++; else { fail++; console.log("FAIL", name, d); } };
const key = (q) => normalise(q).replace(/\s+/g, " ").trim().toLowerCase();
export function dupes(a, b) { const s = new Set(b.map((x) => key(x.q))); return a.filter((x) => s.has(key(x.q))).map((x) => x.q); }

t("120 holdout asks", holdout.length === 120, String(holdout.length));
t("15 out-of-scope asks expect none", holdout.filter((x) => x.expect === "none").length === 15);
t("15 near-duplicate asks expect ask", holdout.filter((x) => x.expect === "ask").length === 15);
t("all six seats present", ["guest", "owner", "pro", "agent", "enterprise", "partner"].every((s) => holdout.some((x) => x.seat === s)));
const ids = new Set(shelves.map((s) => s.id));
t("every expected shelf id exists", holdout.every((x) => x.expect === "none" || x.expect === "ask" || ids.has(x.expect)), holdout.filter((x) => !["none", "ask"].includes(x.expect) && !ids.has(x.expect)).map((x) => x.expect).join());
t("no blank or tab-split fields", fs.readFileSync(new URL("../lib/concierge/holdout.tsv", import.meta.url), "utf8").split("\n").filter(Boolean).every((l) => l.split("\t").length === 3));
t("no duplicate within holdout", new Set(holdout.map((x) => key(x.q))).size === holdout.length);
const d = dupes(holdout, questions);
t("no holdout ask duplicates a questions.tsv ask (normalised)", d.length === 0, d.join(" ; "));
const bl = ["questions_blind.tsv", "questions_blind2.tsv", "questions_wA69.tsv"].map((f) => fs.readFileSync(new URL("../lib/concierge/" + f, import.meta.url), "utf8").split("\n").filter(Boolean).map((l) => ({ q: l.split("\t")[2] })));
t("no holdout ask duplicates a blind set ask", bl.every((b) => dupes(holdout, b).length === 0));
// mutation: the duplicate check must catch a planted copy
const planted = [...holdout, { q: "  " + questions[0].q.toUpperCase() + "!! " }];
t("mutant: planted duplicate is caught", dupes(planted, questions).length >= 1);
const { calls, res } = runHoldout();
t("0 model/network/random calls across the holdout", calls === 0, String(calls));
t("every holdout ask got a verdict", res.length === 120 && res.every((r) => ["none", "ask"].includes(r.got) || /^(portal|offer):/.test(r.got)));
const [lo, hi] = wilson(69, 120);
t("wilson sanity", lo > 0.48 && lo < 0.49 && hi > 0.65 && hi < 0.67, `${lo} ${hi}`);
t("wilson edge n=0 and k=n", wilson(0, 0)[1] === 0 && wilson(10, 10)[1] > 0.99);
console.log(`concierge holdout: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
