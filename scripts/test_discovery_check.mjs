// Tests for scripts/discovery_check.mjs. Synthetic fixtures only, built under a checked mkdtemp.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run, SITE } from "./discovery_check.mjs";

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log(`FAIL ${m}`); } else console.log(`PASS ${m}`); };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "disc-"));
if (!tmp || !tmp.startsWith(os.tmpdir())) throw new Error("bad tmp");
const html = (noindex) => `<html><head>${noindex ? '<meta name="robots" content="noindex"/>' : ""}</head><body>x</body></html>`;

function fixture(name, over = {}) {
  const root = path.join(tmp, name), out = path.join(root, "out"), repo = path.join(root, "repo");
  fs.mkdirSync(path.join(out, ".well-known"), { recursive: true });
  fs.mkdirSync(path.join(repo, "lib/offers"), { recursive: true });
  const put = (p, c) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c); };
  put(path.join(out, "index.html"), html());
  put(path.join(out, "offers.html"), html());
  put(path.join(out, "agents.html"), html());
  put(path.join(out, "thanks.html"), html(true));
  put(path.join(out, "order/x.html"), html());
  put(path.join(out, "404.html"), html());
  put(path.join(repo, "lib/offers/offers.json"), JSON.stringify([{ slug: "a", priceAud: 297 }, { slug: "b", priceAud: 1500 }]));
  put(path.join(repo, "lib/agentTools.generated.json"), JSON.stringify({ tools: [{ name: "catalogue_list" }] }));
  const sm = (locs) => `<?xml version="1.0"?><urlset>${locs.map((l) => `<url><loc>${SITE}${l}</loc></url>`).join("")}</urlset>`;
  const robots = ["User-Agent: *", "Allow: /", ...["/account/", "/seats/", "/admin/", "/api/", "/order/"].map((d) => `Disallow: ${d}`), `Sitemap: ${SITE}/sitemap.xml`, ""].join("\n");
  const llms = `# T\n\n- [/offers](${SITE}/offers): 2 offers from AU$297 to AU$1,500\n- [/agents](${SITE}/agents)\n- MCP https://api.titanos.tech/mcp\n- ${SITE}/sitemap.xml\n`;
  const card = JSON.stringify({ name: "T", description: "d", url: SITE, protocols: [{ url: "https://api.titanos.tech/mcp" }], authentication: {}, tools: [{ name: "catalogue_list", description: "x" }], documentationUrl: SITE + "/agents" });
  const files = { "sitemap.xml": sm(["/", "/offers", "/agents"]), "robots.txt": robots, "llms.txt": llms, ".well-known/agent.json": card, ...over };
  for (const [k, v] of Object.entries(files)) if (v !== null) put(path.join(out, k), v);
  return { out, repo, gen: path.join(root, "gen") };
}
const go = (f) => run({ exportDir: f.out, repo: f.repo, genDir: f.gen });

// clean fixture passes
let f = fixture("clean");
let r = go(f);
ok(r.missing.length === 0 && r.wrong.length === 0, `clean fixture passes (${JSON.stringify([...r.missing, ...r.wrong])})`);
ok(r.publicRoutes === 3 && r.routes === 5, "route list: noindex and 404 handled, gated /order counted as route not public");

// a gated route in the sitemap fails
f = fixture("gated", { "sitemap.xml": `<urlset><url><loc>${SITE}/</loc></url><url><loc>${SITE}/offers</loc></url><url><loc>${SITE}/agents</loc></url><url><loc>${SITE}/order/x</loc></url><url><loc>${SITE}/account</loc></url></urlset>` });
r = go(f);
ok(r.wrong.some((w) => w.includes("gated route listed /order/x")) && r.wrong.some((w) => w.includes("gated route listed /account")), "gated route in sitemap fails");

// a public route absent from the sitemap, a noindex route and a dead url
f = fixture("sm", { "sitemap.xml": `<urlset><url><loc>${SITE}/</loc></url><url><loc>${SITE}/thanks</loc></url><url><loc>${SITE}/gone</loc></url></urlset>` });
r = go(f);
ok(r.missing.some((m) => m.includes("not listed /offers")), "public route missing from sitemap is MISSING");
ok(r.wrong.some((w) => w.includes("noindex route listed /thanks")), "noindex route in sitemap is WRONG");
ok(r.wrong.some((w) => w.includes("/gone does not resolve")), "dead sitemap url is WRONG");

// robots
f = fixture("rb", { "robots.txt": "User-Agent: *\nAllow: /\nDisallow: /offers/\n" });
r = go(f);
ok(r.missing.some((m) => m.includes("gated path /admin")) && r.missing.some((m) => m.includes("Sitemap:")), "robots without gated Disallow or sitemap line is MISSING");
ok(r.wrong.some((w) => w.includes("hides public route /offers")), "robots hiding a public route is WRONG");

// a dead llms.txt link fails
f = fixture("dead", { "llms.txt": `# T\n- [/nope](${SITE}/nope)\n- [x](${SITE}/offers)\n- https://api.titanos.tech/undeclared\n- ${SITE}/account\n` });
r = go(f);
ok(r.wrong.some((w) => w.includes("dead link /nope")), "dead llms.txt link fails");
ok(r.wrong.some((w) => w.includes("not a declared API route")), "undeclared API route fails");
ok(r.wrong.some((w) => w.includes("gated route /account")), "llms.txt link to a gated route fails");

// figures and tools
f = fixture("fig", { "llms.txt": `# T\n- ${SITE}/offers: 5 offers from AU$9,999\n` });
r = go(f);
ok(r.wrong.some((w) => w.includes("AU$9,999")), "price absent from the catalogue fails");
ok(r.wrong.some((w) => w.includes("says 5 offers, catalogue has 2")), "offer count disagreeing with the catalogue fails");
f = fixture("tool", { ".well-known/agent.json": JSON.stringify({ name: "T", description: "d", url: SITE, protocols: [], authentication: {}, tools: [{ name: "invented_tool", description: "costs US$77" }] }) });
r = go(f);
ok(r.wrong.some((w) => w.includes("invented_tool")) && r.wrong.some((w) => w.includes("US$77")), "agent card naming an unknown tool or price fails");
f = fixture("badjson", { ".well-known/agent.json": "{nope" });
ok(go(f).wrong.some((w) => w.includes("not valid JSON")), "invalid agent card JSON fails");

// absent agent card is a note, not a failure
f = fixture("nocard", { ".well-known/agent.json": null });
r = go(f);
ok(r.missing.length === 0 && r.notes.length === 1, "absent agent card is a note only");

// missing files are generated, never into the export dir; two runs are byte-identical
f = fixture("gen", { "sitemap.xml": null, "robots.txt": null, "llms.txt": null });
r = go(f);
ok(r.missing.length === 3 && r.generated.length === 3, "three missing files reported and generated");
ok(!fs.existsSync(path.join(f.out, "sitemap.xml")), "generation never writes into the export dir");
const snap = () => ["sitemap.xml", "robots.txt", "llms.txt"].map((n) => fs.readFileSync(path.join(f.gen, n), "utf8")).join("\0");
const a = snap();
go(f);
ok(a === snap(), "generation is byte-identical across two runs");
const gs = fs.readFileSync(path.join(f.gen, "sitemap.xml"), "utf8");
ok(gs.includes("/offers") && !gs.includes("/order") && !gs.includes("/thanks"), "generated sitemap lists public routes only");
// generated files pass the checker when placed in an export
const f2 = fixture("regen", { "sitemap.xml": gs, "robots.txt": fs.readFileSync(path.join(f.gen, "robots.txt"), "utf8"), "llms.txt": fs.readFileSync(path.join(f.gen, "llms.txt"), "utf8") });
r = go(f2);
ok(r.missing.length === 0 && r.wrong.length === 0, `generated files pass the checker (${JSON.stringify([...r.missing, ...r.wrong])})`);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fail ? `test_discovery_check: ${fail} FAILED` : "test_discovery_check: ALL PASS");
process.exit(fail ? 1 : 0);
