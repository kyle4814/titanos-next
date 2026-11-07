// f307 test: the concierge catalogue (239 KB of offer data) must stay OUT of the shared / first-load JS and be fetched on demand.
// Parts: (1) no app/ or components/ file imports the static catalogue or the offer data; (2) public/concierge/shelves.json is fresh;
// (3) loadAsk fetches lazily and routes the same as the static catalogue; (4) in a built out/, /faq's scripts carry no offer text
// and shelves.json is exported. LAZY_ROOT lets scripts/mutate_concierge_lazy.mjs run this file against a mutated copy.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = (process.env.LAZY_ROOT || new URL("..", import.meta.url).pathname).replace(/\/?$/, "/");
const R = (p) => import(pathToFileURL(root + p).href);
let pass = 0, fail = 0;
const t = (name, ok, extra = "") => { if (ok) pass++; else { fail++; console.log("FAIL " + name + " " + extra); } };
const walk = (d) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
const FORBIDDEN = /(?:concierge\/catalogue|offers\/data\/|["'.\/]catalogue(?:\.ts)?["'])/;

// (1) static imports. lib/shop/catalogue is a different module; only the concierge catalogue and offer data are fenced.
const browserFiles = [...walk(root + "app"), ...walk(root + "components"), root + "lib/concierge/lazy.ts"].filter((f) => /\.(tsx?|jsx?)$/.test(f) && fs.existsSync(f));
const offenders = browserFiles.filter((f) => /^\s*(?:import|export)\b[^;\n]*from\s*["'][^"']*(?:concierge\/catalogue|\/offers\/data\/)/m.test(fs.readFileSync(f, "utf8")) || /\bimport\s*\(\s*["'][^"']*(?:concierge\/catalogue|\/offers\/data\/)/.test(fs.readFileSync(f, "utf8")));
t("no app/components file imports concierge/catalogue or offers/data", offenders.length === 0, offenders.join(","));
const comp = fs.readFileSync(root + "components/Concierge.tsx", "utf8");
t("Concierge uses the lazy loader", /from "@\/lib\/concierge\/lazy"/.test(comp) && /loadAsk\(/.test(comp));
t("Concierge does not call loadAsk at module or render top level (only inside the submit handler)", !/^\s*const\s+\w+\s*=\s*loadAsk\(/m.test(comp) && /async function submit[\s\S]*loadAsk\(\)/.test(comp));
const lazySrc = fs.readFileSync(root + "lib/concierge/lazy.ts", "utf8");
t("lazy.ts names the shelves JSON url", /\/concierge\/shelves\.json/.test(lazySrc));

// (2) the JSON the browser fetches equals the catalogue (Node side may import the static catalogue)
const { SHELVES } = await R("lib/concierge/catalogue.ts");
const jsonPath = root + "public/concierge/shelves.json";
t("public/concierge/shelves.json exists", fs.existsSync(jsonPath));
const raw = fs.existsSync(jsonPath) ? fs.readFileSync(jsonPath, "utf8") : "";
t("shelves.json is fresh against the catalogue (run scripts/gen_concierge_shelves.mjs)", raw === JSON.stringify(SHELVES) + "\n");
t("shelves.json carries offer shelves and portal shelves", SHELVES.some((s) => s.id.startsWith("offer:")) && SHELVES.some((s) => s.id.startsWith("portal:")));

// (3) lazy behaviour
const { loadAsk, SHELVES_URL } = await R("lib/concierge/lazy.ts");
const { makeAsk } = await R("lib/concierge/catalogue.ts");
let calls = 0, lastUrl = "";
const fakeFetch = async (u) => { calls++; lastUrl = String(u); return { ok: true, status: 200, json: async () => JSON.parse(raw) }; };
t("nothing is fetched before loadAsk is called", calls === 0);
const ask = await loadAsk(fakeFetch);
t("loadAsk fetches the shelves JSON exactly once", calls === 1 && lastUrl === SHELVES_URL);
let same = 0; const QS = ["pricing", "scan acme.com.au", "<script>", "bake a cake", "my dashboard", "fake invoices from a supplier", "find reliable subcontractors"];
const stat = makeAsk();
for (const q of QS) { const a = JSON.stringify(await ask(q, "guest")), b = JSON.stringify(await stat(q, "guest")); if (a === b) same++; else console.log("DIFF", q); }
t("lazy answers equal the static catalogue's on " + QS.length + " asks", same === QS.length, same + "/" + QS.length);
let threw = false; try { await loadAsk(async () => ({ ok: false, status: 404, json: async () => [] })); } catch { threw = true; }
t("a failed catalogue fetch rejects (the component then says nothing was saved)", threw);

// (4) built output, when there is one
const out = root + "out";
if (!fs.existsSync(out + "/faq.html")) console.log("built-output half: SKIPPED-NO-BUILD");
else {
  const offerText = [];
  for (const m of ["enterprise", "government", "multipliers-a", "multipliers-b", "sales-selfserve", "specialist", "tradies"]) {
    const src = fs.readFileSync(root + "lib/offers/data/" + m + ".ts", "utf8");
    for (const x of [...src.matchAll(/bluf:\s*"((?:[^"\\]|\\.){40,})"/g)].slice(0, 3)) offerText.push(x[1].slice(0, 60));
  }
  t("found offer marker strings to look for", offerText.length >= 7, String(offerText.length));
  const html = fs.readFileSync(out + "/faq.html", "utf8");
  const srcs = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1].replace(/^\//, "")))].filter((s) => fs.existsSync(path.join(out, s)));
  t("/faq loads scripts", srcs.length > 3, String(srcs.length));
  const hit = offerText.filter((s) => srcs.some((f) => fs.readFileSync(path.join(out, f), "utf8").includes(s)));
  t("no offer data text in any script /faq loads", hit.length === 0, hit.length + " of " + offerText.length + " markers found");
  t("shelves.json is exported to out/concierge/", fs.existsSync(out + "/concierge/shelves.json"));
  // the catalogue must not sit in a chunk shared by every route either
  const idx = fs.readFileSync(out + "/index.html", "utf8");
  const idxSrcs = [...new Set([...idx.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1].replace(/^\//, "")))].filter((s) => fs.existsSync(path.join(out, s)));
  t("no offer data text in the home page's scripts", !offerText.some((s) => idxSrcs.some((f) => fs.readFileSync(path.join(out, f), "utf8").includes(s))));
}
console.log(`concierge lazy: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
