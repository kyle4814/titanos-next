// Guards the Ariance hero case study: consent gate wiring, no invented quote, nulls where unreal,
// copy rules (no em/en dashes, no AI-tell words), and that the page has no hard-coded figures.
import fs from "node:fs";

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const root = new URL("..", import.meta.url).pathname;
const read = (p) => fs.readFileSync(root + p, "utf8");
const d = JSON.parse(read("lib/case-studies/ariance.json"));

ok(typeof d.client_consent === "boolean", "client_consent is a boolean");
ok(d.client_words.quote === null || (typeof d.client_words.quote === "string" && d.client_words.attribution), "a quote needs an attribution (never invented)");
ok(d.speed.brief_received_at === null || /\+10:00$/.test(d.speed.brief_received_at), "brief time is null or has an explicit offset");
for (const p of d.speed.phases) {
  ok(/\+10:00$/.test(p.committed) && /^[0-9a-f]{7}$/.test(p.commit), `phase ${p.id} has a real commit hash and timestamp`);
  ok((p.started === null) === (p.finished === null), `phase ${p.id} window is both set or both null`);
  if (p.started) ok(Date.parse(p.finished) > Date.parse(p.started), `phase ${p.id} finishes after it starts`);
}
ok(d.speed.commits_total >= d.speed.phases.length, "commit total covers the phase commits");
const t = d.quality.tests;
ok(t.tests_failed === 0 && t.tests_passed > 0 && t.files_passed > 0, "test counts present and green");
ok(t.total_after_merge === null || t.total_after_merge >= t.tests_passed, "post-merge total is null or not below main");
ok(d.cost.build_cost_usd === null || typeof d.cost.build_cost_usd === "number", "build cost is null or a number");
ok(d.cost.live_url === null || /^https:\/\//.test(d.cost.live_url), "live url is null or https");
ok(d.methodology.rows.length >= 6, "methodology block has a row per figure group");
ok(d.quality.status_chips.length === 6, "all six status chips documented");

// Copy rules over every string in the JSON.
const strings = [];
(function walk(v) { if (typeof v === "string") strings.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); })(d);
const text = strings.join("\n");
ok(!/[–—]/.test(text), "no em or en dashes in the copy");
ok(!/\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|synerg\w*|tapestry|game[- ]changer)\b/i.test(text), "no AI-tell words in the copy");
ok(!/zenodo.*michael|nested bubble gears/i.test(text), "excluded third-party material absent");

// Page wiring.
const page = read("app/case-studies/ariance/page.tsx");
ok(/index: false, follow: false/.test(page) && /arianceVisible \? /.test(page), "page is noindex unless consent");
ok(!/[–—]/.test(page), "page source has no em or en dashes");
ok(/arianceVisible/.test(read("app/case-studies/page.tsx")), "hero card on /case-studies is consent-gated");
ok(/arianceVisible/.test(read("app/page.tsx")), "homepage link is consent-gated");
ok(/arianceVisible/.test(read("lib/routes.ts")) && /routes/.test(read("app/sitemap.ts")), "sitemap entry is consent-gated (sitemap is generated from lib/routes.ts)");
ok(!/\b\d{2,}\b/.test(page.replace(/"[^"\n]*"|`[^`\n]*`|\/\/.*|\{\/\*.*?\*\/\}/g, "").replace(/\b(fontSize|fontWeight|height|width|gap|padding|margin|minHeight|minWidth|opacity|letterSpacing|borderRadius|lineHeight|marginTop|marginBottom|maxWidth|zIndex|flex|paddingLeft)\b[^,}]*/g, "")), "page logic holds no hard-coded figures");
for (const g of d.quality.gallery) for (const f of [g.phone, g.desktop]) ok(fs.existsSync(root + "public" + f), `screenshot exists: ${f}`);
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
