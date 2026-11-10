// C5 DemandReport tests. SYNTHETIC asks only (invented for this test; no real asker, email or number). Named tests T1..T12 are what the mutants must trip.
import fs from "node:fs";
import { demandReport, stripPii } from "../lib/concierge/demand.ts";
import { gradeShelf, visibleShelves } from "../lib/shop/grader.ts";

let pass = 0, fail = 0;
const t = (name, ok, extra = "") => { if (ok) pass++; else { fail++; console.log("FAIL " + name + " " + extra); } };
const root = new URL("..", import.meta.url).pathname;
const A = (ask, askerId) => ({ ask, askerId });

t("T1 empty input", demandReport([]).length === 0 && demandReport(undefined).length === 0 && demandReport([null, {}, { ask: 5 }]).length === 0);
const one = demandReport([A("do you do wedding photography invoicing", "u1")]);
t("T2 single ask", one.length === 1 && one[0].ask_count === 1 && one[0].distinct_askers === 1 && one[0].status === "UNGRADED_PROPOSAL" && /^dc-[0-9a-f]{8}$/.test(one[0].cluster_id));
const dup = demandReport([A("Do you build wedding photography invoicing?", "u1"), A("wedding photography invoicing please", "u2"), A("can you do wedding photography invoices", "u3"), A("quote for roof inspection drones", "u4")]);
t("T3 near-duplicates cluster", dup.length === 2 && dup[0].ask_count === 3 && dup[0].distinct_askers === 3 && dup[1].ask_count === 1, JSON.stringify(dup));
const flood = demandReport([...Array.from({ length: 50 }, () => A("wedding photography invoicing", "spammer")), A("quote for roof inspection drones", "u1"), A("roof inspection drones quote", "u2")]);
t("T4 one asker flooding counts once", flood[0].label.includes("dron") && flood[0].distinct_askers === 2 && flood[1].distinct_askers === 1 && flood[1].ask_count === 50, JSON.stringify(flood));
const off = demandReport([A("what is the weather forecast tomorrow", "u1"), A("best pizza near me", "u2"), A("netflix password reset", "u3"), A("wedding photography invoicing", "u4")]);
t("T5 off-topic dropped", off.length === 1 && off[0].label.includes("wedd"), JSON.stringify(off));
const pii = demandReport([A("invoice wedding photography email me at jo.bloggs@example.com or call 0412 345 678 see https://example.com/x and www.example.org", "u1")]);
const sampleTxt = JSON.stringify(pii);
t("T6 PII stripped", pii.length === 1 && !/@|0412|345|https?:|www\.|example\.(com|org)/.test(sampleTxt), sampleTxt);
t("T6b stripPii unit", stripPii("a@b.co 555-123-4567 http://x.io/y z") === "z" || !/@|555|http/.test(stripPii("a@b.co 555-123-4567 http://x.io/y z")));
// T7: an UNGRADED_PROPOSAL cannot reach the shelf renderer or the sitemap.
const stub = flood[0];
const forged = { ...stub, grade: { pass: true, checks: [] } };
t("T7a stub fails the shelf grader", gradeShelf(stub).pass === false);
t("T7b forged pass flag still hidden by visibleShelves", visibleShelves([forged]).length === 0 && visibleShelves([{ ...stub }]).length === 0);
const shopSrc = fs.readFileSync(root + "scripts/build_shop.mjs", "utf8");
t("T7c sitemap feeds only from lib/routes, which never reads proposals", /from "@\/lib\/routes"/.test(fs.readFileSync(root + "app/sitemap.ts", "utf8")) && !/demand|cluster_id|UNGRADED/.test(fs.readFileSync(root + "app/sitemap.ts", "utf8") + fs.readFileSync(root + "lib/routes.ts", "utf8")));
t("T7d build/render path never imports the demand module", !/concierge\/demand/.test(shopSrc) && !/concierge\/demand/.test(fs.readFileSync(root + "lib/routes.ts", "utf8")) && !/concierge\/demand/.test(fs.readFileSync(root + "lib/shop/loader.ts", "utf8")));
t("T7e every stub is UNGRADED_PROPOSAL, never carries grade/availability/buyUrl", dup.concat(flood, off).every((s) => s.status === "UNGRADED_PROPOSAL" && !("grade" in s) && !("buyUrl" in s) && !("availability" in s)));
// T8 determinism: byte-equal across runs and across input order.
const recs = [A("wedding photography invoicing", "u1"), A("invoicing for wedding photography", "u2"), A("roof inspection drones", "u3"), A("drone roof inspection quote", "u4"), A("tax help for bakers", "u5")];
const r1 = JSON.stringify(demandReport(recs)), r2 = JSON.stringify(demandReport(recs));
t("T8 byte-equal across two runs", r1 === r2);
t("T9 byte-equal across input order", JSON.stringify(demandReport([...recs].reverse())) === r1);
// T10 stable sort on ties: equal counts order by label, never by input order.
const ties = demandReport([A("zebra stable farming", "u1"), A("alpha orchard watering", "u2"), A("mango pricing sheet", "u3")]);
t("T10 tie order is by label", ties.map((s) => s.label).join("|") === [...ties.map((s) => s.label)].sort().join("|") && ties.length === 3, JSON.stringify(ties.map((s) => s.label)));
// T11 caps
const WORDS = "zebra orchard mango kettle ladder pigeon saddle tundra violin walnut yoghurt anchor bamboo cactus dolphin ember falcon glacier harbour igloo jungle kiwi lantern meadow nectar oyster plume quartz ribbon summit".split(" ");
const many = WORDS.map((w, i) => A("custom " + w + " service", "u" + i));
t("T11 topN respected, samples max 3, sample length bounded", demandReport(many, { topN: 5 }).length === 5 && demandReport([A("a".repeat(500) + " invoicing", "u1"), A("b invoicing", "u2"), A("c invoicing", "u3"), A("d invoicing", "u4")], { jac: 0.2 })[0].sample_asks.length <= 3 && demandReport([A("a".repeat(500) + " invoicing", "u1")])[0].sample_asks[0].length <= 160);
// T12 anon bucket: records without an id are one asker.
t("T12 missing askerId counts as one asker", demandReport([{ ask: "wedding photography invoicing" }, { ask: "wedding photography invoicing" }])[0].distinct_askers === 1);
console.log(`demand: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
