// F60 regression: the ask-raising guard. lib/concierge/ask_dev.tsv is a DEV set (hand-written, not copied from the holdout);
// the holdout is never tuned on. This test also proves the dev set shares no normalised phrase with any other labelled set.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { index } from "./concierge_eval.mjs";
const root = new URL("..", import.meta.url).pathname;
const { route } = await import(pathToFileURL(root + "lib/concierge/router.ts").href);
const { normalise } = await import(pathToFileURL(root + "lib/concierge/text.ts").href);
const G = await import(pathToFileURL(root + "lib/concierge/askguard.ts").href);
let pass = 0, fail = 0;
const t = (name, ok, extra = "") => { if (ok) pass++; else { fail++; console.log("FAIL", name, extra); } };
const rows = (f) => fs.readFileSync(root + "lib/concierge/" + f, "utf8").split("\n").filter(Boolean).map((l) => { const [seat, expect, q] = l.split("\t"); return { seat, expect, q }; });
const dev = rows("ask_dev.tsv");
const got = (r) => (r.kind === "match" ? r.shelf.id : r.kind === "unmatched" ? "none" : "ask");

t("dev set has at least 40 rows", dev.length >= 40, dev.length);
t("dev set has at least 25 ask rows", dev.filter((x) => x.expect === "ask").length >= 25);
t("dev set has at least 8 keep rows (a dedicated door must stay a match)", dev.filter((x) => x.expect !== "ask").length >= 8);
t("dev set shape (3 tab columns, known seats)", dev.every((x) => x.seat && x.expect && x.q && ["guest", "owner", "pro", "agent", "enterprise", "partner"].includes(x.seat)));
t("dev set covers all six seats", new Set(dev.map((x) => x.seat)).size === 6);
const norm = dev.map((x) => normalise(x.q));
t("no internal duplicate", new Set(norm).size === norm.length);
let clash = 0;
for (const f of ["holdout.tsv", "questions.tsv", "questions_blind.tsv", "questions_blind2.tsv", "questions_wA69.tsv"]) { const s = new Set(rows(f).map((x) => normalise(x.q))); clash += norm.filter((n) => s.has(n)).length; }
t("no normalised clash with the holdout or any other labelled set", clash === 0, clash);

// zero model, network or random calls while routing
const realFetch = globalThis.fetch, realRandom = Math.random; let calls = 0;
globalThis.fetch = () => { calls++; throw new Error("network forbidden"); }; Math.random = () => { calls++; return 0.5; };
const res = dev.map((x) => ({ ...x, r: route(index, x.q, x.seat) }));
globalThis.fetch = realFetch; Math.random = realRandom;
t("0 network or random calls", calls === 0, calls);
for (const x of res) t("dev: " + x.q, got(x.r) === x.expect, "want " + x.expect + " got " + got(x.r));
for (const x of res.filter((x) => x.expect === "ask")) t("ask has 2 to 3 taps with real hrefs: " + x.q, x.r.kind === "ask" && x.r.taps.length >= 2 && x.r.taps.length <= 3 && x.r.taps.every((p) => p.href && p.shelfId && p.label));

// the lost-intent guard must not steal asks that name a subject
for (const [q, no] of [["I cannot find my invoices", 1], ["cant find the refund page", 1], ["where do I start with a scan of my domain", 1], ["I am lost", 0], ["none of this is what I need", 0]]) t("lostIntent " + q, G.lostIntent(q) === !no);
// lost asks hand off to a person: contact is always among the taps for a seat that may see it
t("lost ask offers the contact door", res.filter((x) => /cannot find what|none of this/.test(x.q)).every((x) => x.r.kind === "ask" && x.r.taps.some((p) => p.shelfId === "portal:contact")));

// mutants: remove each half of the guard and the dev set must go red
const saved = new Map(G.FAMILY_OF);
G.FAMILY_OF.clear();
const m1 = dev.filter((x) => x.expect === "ask" && got(route(index, x.q, x.seat)) !== "ask").length;
t("MUTANT families off: at least 11 dev ask rows go red (F80 twin guard now also catches some of the 15 once the family skip is gone)", m1 >= 11, m1);
for (const [k, v] of saved) G.FAMILY_OF.set(k, v);
const m2 = dev.filter((x) => x.expect === "ask" && got(route(index, x.q, x.seat)) !== "ask").length;
t("families restored: dev ask rows all green again", m2 === 0, m2);
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
