// Glossary term pages gate (lib/glossaryPages.ts, app/glossary/[term]). Pure data checks, then the sitemap routes.
// Run: node --no-warnings --import ./scripts/alias_loader.mjs --experimental-strip-types scripts/test_glossary_pages.mjs
import fs from "node:fs";
import path from "node:path";
import { GLOSSARY } from "../lib/glossary.ts";
import { GLOSSARY_PAGES, DEEP, pageWordCount, deepWordCount, pageTexts } from "../lib/glossaryPages.ts";
import { POSTS } from "../lib/blog.ts";
import { GUIDES } from "../lib/guides.ts";

const fails = [];
const bad = (m) => fails.push(m);
const TELLS = /\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|synerg\w*|harness\w*|ecosystem|in today's|dive into|it's important to note)\b|[–—]/i;
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

if (GLOSSARY_PAGES.length < 25) bad(`only ${GLOSSARY_PAGES.length} term pages (need 25+)`);
// The terms the task names must each have a page.
for (const id of ["spf", "dkim", "dmarc", "bimi", "mta-sts", "tls-rpt", "phishing", "email-spoofing", "bec", "ndb", "app", "essential-eight", "mfa"]) {
  if (!GLOSSARY_PAGES.some((p) => p.entry.id === id)) bad(`required term page missing: ${id}`);
}
for (const id of Object.keys(DEEP)) if (!GLOSSARY.some((e) => e.id === id)) bad(`deep content for unknown glossary id: ${id}`);
for (const e of GLOSSARY) if (!DEEP[e.id]) bad(`glossary entry without a term page: ${e.id}`);

const postSlugs = new Set(POSTS.map((p) => p.slug));
const guideSlugs = new Set(GUIDES.map((g) => g.slug));
const ids = new Set(GLOSSARY_PAGES.map((p) => p.entry.id));
const appDirs = fs.readdirSync(path.join(root, "app"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
function routeExists(h) {
  const seg = h.split("#")[0].split("?")[0].split("/").filter(Boolean);
  if (seg.length === 0) return true;
  if (seg[0] === "blog" && seg[1]) return postSlugs.has(seg[1]);
  if (seg[0] === "guides" && seg[1]) return guideSlugs.has(seg[1]);
  if (seg[0] === "glossary" && seg[1]) return ids.has(seg[1]);
  if (seg[0] === "tools" && seg[1]) return seg.length === 2 && fs.existsSync(path.join(root, "app/tools", seg[1], "page.tsx"));
  if (seg[0] === "email-security" && seg[1] === "setup") return fs.existsSync(path.join(root, "app/email-security/setup"));
  return appDirs.includes(seg[0]) && seg.length === 1;
}

const titles = new Set();
const descs = new Set();
for (const p of GLOSSARY_PAGES) {
  const tag = `[${p.entry.id}]`;
  if (!/^[a-z0-9-]+$/.test(p.entry.id)) bad(`${tag} id`);
  if (p.title.length > 60) bad(`${tag} title ${p.title.length} > 60: ${p.title}`);
  if (titles.has(p.title)) bad(`${tag} duplicate title`);
  titles.add(p.title);
  if (p.description.length < 140 || p.description.length > 160) bad(`${tag} description ${p.description.length} not 140-160`);
  if (descs.has(p.description)) bad(`${tag} duplicate description`);
  descs.add(p.description);
  const words = pageWordCount(p);
  if (words < 300) bad(`${tag} page word count ${words} < 300`);
  if (deepWordCount(p.deep) < 250) bad(`${tag} long-form content ${deepWordCount(p.deep)} words < 250`);
  if (p.deep.body.length < 2) bad(`${tag} needs 2+ explanatory paragraphs`);
  if (!p.deep.example.text || !p.deep.example.title) bad(`${tag} needs an example`);
  if (p.deep.steps.length < 3) bad(`${tag} needs 3+ steps`);
  if (p.deep.links.length < 3) bad(`${tag} needs 3+ internal links`);
  if (p.deep.see.length < 3) bad(`${tag} needs 3+ related terms`);
  for (const s of p.deep.see) if (!ids.has(s)) bad(`${tag} related term missing: ${s}`);
  if (p.deep.see.includes(p.entry.id)) bad(`${tag} relates to itself`);
  for (const l of p.deep.links) if (!routeExists(l.href)) bad(`${tag} broken internal link: ${l.href}`);
  if (!/^https:\/\//.test(p.entry.source.url)) bad(`${tag} source must be https`);
  for (const t of pageTexts(p)) if (TELLS.test(t)) bad(`${tag} banned word or dash: ${t.match(TELLS)[0]} in "${t.slice(0, 60)}"`);
  if (/TITANOS_POSTAL|BEGIN (RSA|PRIVATE)|sk-[A-Za-z0-9]{10}/.test(pageTexts(p).join(" "))) bad(`${tag} secret-like text`);
}

// Page file wiring.
const page = fs.readFileSync(path.join(root, "app/glossary/[term]/page.tsx"), "utf8");
for (const needle of ["generateStaticParams", "dynamicParams = false", "canonical", "DefinedTerm", "breadcrumbs(", "robots: { index: true"]) {
  if (!page.includes(needle)) bad(`app/glossary/[term]/page.tsx missing ${needle}`);
}
if (!fs.readFileSync(path.join(root, "app/glossary/page.tsx"), "utf8").includes("/glossary/${e.id}")) bad("glossary index does not link to the term pages");

// Sitemap: lib/routes.ts reads node:fs and the whole content tree, so check its wiring as text.
const routes = fs.readFileSync(path.join(root, "lib/routes.ts"), "utf8");
if (!/for \(const \w+ of GLOSSARY_PAGES\) out\.push\(mk\(`\/glossary\/\$\{/.test(routes)) bad("lib/routes.ts does not add the glossary term pages to the sitemap");
if (!fs.readFileSync(path.join(root, "lib/llmsFacts.ts"), "utf8").includes("/glossary/${e.id}")) bad("llms.txt facts do not link the term pages");

if (fails.length) {
  console.error(`glossary pages: ${fails.length} failure(s)`);
  for (const f of fails) console.error("FAIL", f);
  process.exit(1);
}
console.log(`glossary pages: ok (${GLOSSARY_PAGES.length} term pages, min ${Math.min(...GLOSSARY_PAGES.map(pageWordCount))} words)`);
