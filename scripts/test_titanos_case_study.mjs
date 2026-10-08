// Guards the TITANOS self case study: every inline figure is labelled with source and date, ledger keys resolve,
// the index links to the route, the route is in the site map, copy rules hold (no em/en dashes, no AI-tell words),
// and no internal path, tool name or private detail leaks into the data.
import fs from "node:fs";

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const root = new URL("..", import.meta.url).pathname;
const read = (p) => fs.readFileSync(root + p, "utf8");
const d = JSON.parse(read("lib/case-studies/titanos.json"));
const ledger = JSON.parse(read("lib/ledger.json"));

const figs = [...d.gold.figures, ...d.receipts.figures];
ok(figs.length >= 6, "at least six inline receipt figures");
ok(figs.every((f) => ["MEASURED", "MODELLED"].includes(f.label) && f.source && /^2026-\d\d-\d\d$/.test(f.date) && f.big && f.text), "every inline figure has a MEASURED/MODELLED label, a source and a date");
ok(new Set(figs.map((f) => f.id)).size === figs.length, "figure ids are unique");
const keys = [...d.big.more_ledger, ...d.receipts.ledger];
ok(keys.every((k) => ledger.facts[k] && ["MEASURED", "MODELLED"].includes(ledger.facts[k].label)), "every ledger key resolves to a labelled fact");
ok(["estate_sloc", "estate_repos", "suites_now", "model_team", "elapsed_months"].every((k) => ledger.n[k]), "ledger numbers the page reads exist");
ok(d.gold.figures.some((f) => f.big === "US$0.2661") && d.gold.figures.some((f) => f.big === "724 / 724"), "gold pack receipt figures present (cost record 0.2661, 724/724)");
ok(d.gold.paragraphs.join(" ").includes("1 minute 49 seconds"), "gold pack time stated as 1 minute 49 seconds");
ok(d.wrong.paragraphs.length >= 2 && d.unproven.paragraphs.length >= 2, "a what-went-wrong and a not-proven-yet section both exist");
ok(d.close.paragraphs[0].includes("Would it be okay if"), "permission close at the end");

const strings = [];
(function walk(v) { if (typeof v === "string") strings.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); })(d);
const text = strings.join("\n");
ok(!/[–—]/.test(text), "no em or en dashes in the copy");
ok(!/\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|synerg\w*|tapestry|game[- ]changer)\b/i.test(text), "no AI-tell words in the copy");
ok(!/\/home\/|~\/|\.py\b|\.jsonl?\b|\.sh\b|bin\/|klinge|state\/|SOUL|LEXICON|CORE\.md|demonblade|kyle|megalodon|jobseeker|stroke|prison/i.test(text), "no internal path, tool name, doctrine term or private detail in the copy");
ok(!/\b(replace(s|d)? (your )?(staff|people|team))\b/i.test(text), "no replacement language");

ok(read("app/case-studies/page.tsx").includes("titanosPath"), "case studies index links to the route");
ok(read("lib/routes.ts").includes("titanosPath"), "route is in the site map");
ok(fs.existsSync(root + "app/case-studies/titanos/page.tsx"), "route file exists");
const page = read("app/case-studies/titanos/page.tsx");
ok(!/\bUS\$\s?\d|\bAU\$\s?\d/.test(page.replace(/\/\/.*$/gm, "")), "page file has no hand-typed dollar figure");
console.log(fail ? `FAILED ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
