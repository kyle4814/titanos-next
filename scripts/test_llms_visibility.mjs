// AI search visibility gate: llms.txt and llms-full.txt list every sitemap route, every guide carries an
// answer-first summary that also appears in llms-full.txt, robots.txt allows the major AI crawlers and still
// blocks the private areas, and the files carry no dashes or banned words.
// Usage: node --no-warnings --import ./scripts/alias_loader.mjs --experimental-strip-types scripts/test_llms_visibility.mjs
import { GET as llms } from "../app/llms.txt/route.ts";
import { GET as llmsFull } from "../app/llms-full.txt/route.ts";
import sitemap from "../app/sitemap.ts";
import robots from "../app/robots.ts";
import { GUIDES } from "../lib/guides.ts";

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail = 1; };
const short = await llms().text();
const full = await llmsFull().text();
const urls = sitemap().map((r) => r.url);
ok(urls.length > 50, `sitemap has ${urls.length} routes`);
for (const [name, body] of [["llms.txt", short], ["llms-full.txt", full]]) {
  const lines = new Set(body.split("\n").map((l) => l.replace(/^- /, "").replace(/^\[[^\]]*\]\(([^)]*)\).*$/, "$1").trim()));
  const missing = urls.filter((u) => !body.includes(u === "https://titanos.tech/" ? "- https://titanos.tech/\n" : `${u}\n`) && !lines.has(u));
  ok(missing.length === 0, `${name} lists every sitemap route (${urls.length - missing.length}/${urls.length})${missing.length ? " missing: " + missing.slice(0, 5).join(", ") : ""}`);
  ok(!/[–—]/.test(body), `${name} has no em or en dash`);
  ok(!/\b(delve|leverage|robust|holistic|landscape|cutting-edge|ecosystem|streamline|synergy)\b/i.test(body), `${name} has no banned words`);
}
for (const g of GUIDES) {
  const w = g.answer.split(/\s+/).length;
  ok(w >= 30 && w <= 75, `${g.slug} answer is ${w} words`);
  ok(full.includes(g.answer), `${g.slug} answer appears in llms-full.txt`);
}
const r = robots();
const agents = r.rules.map((x) => x.userAgent);
for (const a of ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended", "CCBot", "Meta-ExternalAgent", "Amazonbot", "DuckAssistBot"]) {
  const rule = r.rules.find((x) => x.userAgent === a);
  ok(!!rule && rule.allow === "/" && rule.disallow.includes("/d/") && rule.disallow.includes("/order/"), `robots allows ${a} and keeps private areas out`);
}
ok(agents.includes("*") && r.sitemap.endsWith("/sitemap.xml"), "robots has wildcard rule and sitemap");
process.exit(fail);
