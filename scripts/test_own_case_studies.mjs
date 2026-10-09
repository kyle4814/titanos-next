// Guards the own-product case studies: consent gate wiring (Felicia and Pala hidden until Kyle flips it), every figure
// labelled with a source and a date, ledger keys that exist, copy rules, no personal detail beyond a first name,
// and that every gallery screenshot exists on disk.
import fs from "node:fs";

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const root = new URL("..", import.meta.url).pathname;
const read = (p) => fs.readFileSync(root + p, "utf8");
const d = JSON.parse(read("lib/case-studies/own.json"));
const ledger = JSON.parse(read("lib/ledger.json"));

ok(d.studies.length === 3, "three own-product studies");
const by = Object.fromEntries(d.studies.map((s) => [s.slug, s]));
ok(by["felicias-sanctum"]?.consent === false, "Felicia's study stays hidden (consent false) until Kyle confirms");
ok(by["palas-build-with-ai"]?.consent === false, "Pala's study stays hidden (consent false) until Kyle confirms");
ok(typeof by["titanos-hud"]?.consent === "boolean", "HUD consent is a boolean");

for (const s of d.studies) {
  ok(typeof s.consent === "boolean", `${s.slug}: consent is a boolean`);
  const rows = [...(s.facts || []), ...(s.ledger_facts || []).map((l) => ({ ...(ledger.n[l.key] || {}), tag: (ledger.n[l.key] || {}).label, as_of: (ledger.n[l.key] || {}).as_of }))];
  ok(rows.length >= 6, `${s.slug}: at least six figures`);
  for (const r of rows) {
    ok(["MEASURED", "MODELLED"].includes(r.tag) && r.source && /^2026-\d\d-\d\d/.test(r.as_of || ""), `${s.slug}: figure "${r.value ?? r.label}" has a tag, a source and a date`);
  }
  for (const l of s.ledger_facts || []) ok(ledger.n[l.key] && ledger.n[l.key].label === "MEASURED", `${s.slug}: ledger key ${l.key} exists and is MEASURED`);
  for (const g of s.gallery) for (const f of [g.phone, g.desktop]) ok(fs.existsSync(root + "public" + f), `${s.slug}: screenshot exists ${f}`);
  ok(s.gallery.length >= 3, `${s.slug}: gallery of at least three screens`);
  ok(s.limits.length >= 1 && s.status, `${s.slug}: states what is not measured and where it stands`);
}
ok(by["felicias-sanctum"].gallery.length === 7 && by["palas-build-with-ai"].gallery.length === 5, "Felicia has 7 screens and Pala 5, each at both sizes");
ok(/stand-in/i.test(by["felicias-sanctum"].gallery_note) && /stand-in/i.test(by["palas-build-with-ai"].gallery_note), "gallery notes disclose that the AI replies are stand-in text");

const strings = [];
(function walk(v) { if (typeof v === "string") strings.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); })(d);
const text = strings.join("\n");
ok(!/[–—]/.test(text), "no em or en dashes in the copy");
ok(!/\b(delve|unlock\w*|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|synerg\w*|tapestry|game[- ]changer)\b/i.test(text), "no AI-tell words in the copy");
ok(!/stroke|akathisia|prison|jobseeker|surname|deligny|graham|\babn\b|megalodon/i.test(text), "no personal detail about Kyle or the learners");
ok(!/\b(Felicia|Pala)\s+[A-Z][a-z]+/.test(text.replace(/Felicia's Sales|Pala's Build|Felicia's|Pala's/g, "")), "learners are named by first name only");
ok(!/\/home\//.test(text), "no filesystem path in the copy");

const page = read("app/case-studies/own/[slug]/page.tsx");
ok(/index: false, follow: false/.test(page) && /ownVisible\(s\) \?/.test(page), "page is noindex unless consent");
ok(!/[–—]/.test(page), "page source has no em or en dashes");
ok(/OWN_VISIBLE/.test(read("app/case-studies/page.tsx")), "list cards are consent-gated");
ok(/OWN_VISIBLE/.test(read("lib/routes.ts")), "sitemap entries are consent-gated (sitemap is generated from lib/routes.ts)");
ok(/replace\(\/\\\/home/.test(read("lib/case-studies/own.ts")), "ledger sources are stripped of home paths");
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
