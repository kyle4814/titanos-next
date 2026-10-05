// node scripts/test_finder.mjs  (Node 22+ strips TS types; finder.ts is pure so it imports directly)
import { readdirSync, readFileSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  recommend, WHO_OPTIONS, NEED_OPTIONS, BUDGET_OPTIONS, inferFromText, understood,
} from "../lib/offers/finder.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "lib", "offers", "data");
const links = JSON.parse(readFileSync(join(root, "lib", "offers", "links.json"), "utf8"));
const offers = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith(".ts")).sort()) {
  const mod = await import(pathToFileURL(join(dir, f)).href);
  for (const v of Object.values(mod)) if (Array.isArray(v)) offers.push(...v);
}
const availability = (o) => (o.status !== "READY" ? "SOON" : links[o.slug] ? "BUYABLE" : "OPENING");
const ctx = { offers, availability };
const slugs = new Set(offers.map((o) => o.slug));

let fails = 0;
const ok = (name, cond, extra = "") => { if (!cond) { fails++; console.error(`FAIL ${name} ${extra}`); } };

// every combination
let combos = 0;
for (const w of WHO_OPTIONS) for (const n of NEED_OPTIONS) for (const b of BUDGET_OPTIONS) {
  combos++;
  const a = { who: w.id, need: n.id, budget: b.id };
  const r = recommend(a, ctx);
  const tag = `${w.id}/${n.id}/${b.id}`;
  ok(`>=3 ${tag}`, r.top.length === 3, `got ${r.top.length}`);
  ok(`determinism ${tag}`, JSON.stringify(r) === JSON.stringify(recommend(a, ctx)));
  ok(`unique ${tag}`, new Set([...r.top, ...r.also].map((o) => o.slug)).size === r.top.length + r.also.length);
  for (const o of [...r.top, ...r.also]) {
    ok(`slug exists ${tag} ${o.slug}`, slugs.has(o.slug));
    ok(`reason ${tag} ${o.slug}`, typeof r.reason[o.slug] === "string" && r.reason[o.slug].length > 0);
  }
  if (b.id === "under100") for (const o of r.top)
    ok(`under100 ${tag} ${o.slug}`, o.priceAud !== null && o.cadence !== "quote" && o.priceAud <= 100, `price ${o.priceAud}`);
  if (b.id === "100to499") for (const o of r.top)
    ok(`100to499 ${tag} ${o.slug}`, !(o.priceAud !== null && o.cadence !== "quote" && o.priceAud > 499), `price ${o.priceAud}`);
  if (b.id !== "free" && b.id !== "under100") {
    const anyAct = offers.some((o) => availability(o) !== "SOON" && (r.top.length > 0));
    if (anyAct && r.top.every((o) => availability(o) === "SOON") && w.id !== "unsure")
      console.warn(`note: all SOON for ${tag}`);
  }
  if (b.id === "free") for (const o of r.top)
    ok(`free ${tag} ${o.slug}`, o.priceAud !== null && o.priceAud <= 100);
}

// budget wording
ok("cheap -> under100", inferFromText("something cheap").budget === "under100");
ok("$50 -> under100", inferFromText("about $50").budget === "under100");
ok("$300 -> 100to499", inferFromText("$300 a month").budget === "100to499");
ok("it is not a partner", inferFromText("I want it cheap").who === undefined);
ok("email alone is not protect", inferFromText("drowning in email").need === "hours");
ok("typo sparkey -> tradie", inferFromText("sparkey").who === "tradie");
ok("gibberish not understood", !understood("necesito ayuda"));
// at least one actionable offer for the key personas
for (const [who, need, budget] of [["partner","partners","100to499"],["unsure","explore","100to499"],["sales","work","500plus"],["enterprise","board","500plus"]]) {
  const r = recommend({ who, need, budget }, ctx);
  ok(`actionable ${who}/${need}/${budget}`, r.top.some((o) => availability(o) !== "SOON"), r.top.map((o) => o.slug).join(","));
}
// plumber free text ranks a tradies offer first
const p = recommend({ who: "unsure", need: "explore", budget: "100to499", text: "I am a plumber" }, ctx);
ok("plumber -> tradies first", p.top[0].group === "tradies", p.top[0].slug);
const p2 = recommend({ who: "unsure", need: "explore", budget: "100to499", text: "sparky looking for more jobs" }, ctx);
ok("sparky -> tradies first", p2.top[0].group === "tradies", p2.top[0].slug);

// BUYABLE outranks an equal SOON one
const base = offers.find((o) => o.group === "tradies" && availability(o) === "BUYABLE");
const twinSoon = { ...base, slug: "aaa-twin-soon" };
const twinBuy = { ...base, slug: "zzz-twin-buy" };
const ctx2 = {
  offers: [twinSoon, twinBuy, ...offers.filter((o) => o.group !== "tradies").slice(0, 6)],
  availability: (o) => (o.slug === "aaa-twin-soon" ? "SOON" : o.slug === "zzz-twin-buy" ? "BUYABLE" : availability(o)),
};
const t = recommend({ who: "tradie", need: "work", budget: "100to499" }, ctx2);
const iBuy = t.top.findIndex((o) => o.slug === "zzz-twin-buy");
const iSoon = t.top.findIndex((o) => o.slug === "aaa-twin-soon");
ok("BUYABLE beats equal SOON", iBuy !== -1 && (iSoon === -1 || iBuy < iSoon), `buy ${iBuy} soon ${iSoon}`);

console.log(`${combos} combinations checked, ${fails} failure(s)`);
if (fails) process.exit(1);
console.log("test_finder: PASS");
