// Final Business Declaration gates. Source checks always; with `--built out` also checks the exported site.
// Covers: one content source, banned words and dashes, no addresses or hostnames, course links null -> waitlist,
// case-study list == CASES, PDF present and in step with the source, popup source contract, the subscribe route contract.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const read = (p) => fs.readFileSync(p, "utf8");
const D = await import(new URL("../lib/declaration.ts", import.meta.url).href);
const { CASES } = await import(new URL("../lib/caseStudies.ts", import.meta.url).href);
const { PRICING } = await import(new URL("../lib/pricing.ts", import.meta.url).href);

const text = D.declarationText();
const BANNED = /\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|ecosystem\w*|synerg\w*|harness\w*)\b/i;
ok(!/[–—]/.test(text), "declaration text has no em or en dash");
ok(!BANNED.test(text), "declaration text has no banned AI-tell words");
ok(text === text.toString() && !/[A-Z]{12,}/.test(text.replace(/TITANOS|OPERATOR_STATED/g, "")), "copy is normal case, not capitals");

// no addresses, hostnames of private infrastructure, or credentials in anything public
const IP = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
const HOST = /\b[a-z0-9-]+\.(workers\.dev|internal|local|lan)\b|titanos-cloud-runner|ssh\b|id_rsa|BEGIN [A-Z ]*KEY|sk_(live|test)_|whsec_/i;
const publicFiles = ["lib/declaration.ts", "components/declaration/Parts.tsx", "components/declaration/DeclarationPopup.tsx", "components/declaration/SubscribeForm.tsx", "app/declaration/page.tsx", "scripts/gen_declaration_pdf.mjs"];
for (const f of ["lib/declaration.ts", "components/declaration/Parts.tsx", "components/declaration/DeclarationPopup.tsx", "components/declaration/SubscribeForm.tsx", "app/declaration/page.tsx"]) {
  const t = read(f);
  ok(!IP.test(t), `${f}: no IP address`);
  ok(!HOST.test(t.replace(/\/\/[^\n]*/g, "")), `${f}: no private hostname or credential pattern`);
}
ok(!IP.test(text) && !HOST.test(text), "declaration text: no IP address, private hostname or credential pattern");
ok(!/felicia/i.test(text + publicFiles.map(read).join("")), "no private name appears anywhere in the declaration files");
ok(!/\b(stroke|prison|JobSeeker|akathisia|centrelink)\b/i.test(text), "nothing about personal life, health or history");

// every figure carries a source, a date and a status; the appendix prints all of them
ok(D.FIGURES.every((f) => f.source && /^\d{4}-\d{2}-\d{2}$/.test(f.asOf) && ["MEASURED", "COMPUTED", "PUBLISHED", "OPERATOR_STATED"].includes(f.status) && f.method), "every figure has source, ISO date, status and method");
ok(new Set(D.FIGURES.map((f) => f.id)).size === D.FIGURES.length, "figure ids are unique");
ok(D.ACHIEVEMENT_IDS.every((id) => D.FIG[id]), "every achievement points at a figure");
const ledger = JSON.parse(read("lib/ledger.json")).n;
ok(ledger.estate_sloc.value === 230797 && D.FIG.loc.value === "230,797", "LOC figure matches the site ledger");
ok(ledger.tests_main.value === 6314 && D.FIG.ledger_tests.value === "6,314", "test-case figure matches the site ledger");
ok(ledger.cost_job_x.value === 8.4 && ledger.cost_job_before.value === 0.97 && ledger.cost_job_after.value === 0.12 && /8\.4 times/.test(D.FIG.cost_job.line), "cost-per-job figure matches the site ledger");
ok(ledger.fleet_jobs_24h.value === 1451 && ledger.fleet_fail_rate_24h.value === 1.1 && ledger.fleet_median_job_min.value === 3, "fleet figures match the site ledger");
ok(ledger.compute_build_aud_month.value === 46 && ledger.compute_today_aud_month.value === 300 && ledger.compute_build_aud_month.label === "OPERATOR_STATED", "cost figures match the ledger and stay labelled operator-stated");
const manifestLines = read("scripts/test_manifest.txt").split("\n").filter((l) => l && !l.startsWith("#"));
ok(D.FIG.site_tests.value === String(manifestLines.length) || manifestLines.length > Number(D.FIG.site_tests.value), "test-manifest figure is not above the real count (the manifest only grows)");

// prices come from the price file, not typed
ok(D.SUBSCRIPTIONS.some((r) => r.price.includes(String(PRICING.AI_GROWTH_PARTNER).replace(/(\d)(\d{3})/, "$1,$2"))), "subscription rows read from lib/pricing.ts");
ok(D.SUBSCRIPTIONS.every((r) => r.href.startsWith("/") && fs.existsSync(path.join("app", r.href.slice(1).split("#")[0], "page.tsx"))), "every price row links to an existing page");

// case studies: the declaration list is CASES, same slugs, same order, same count
ok(D.CASE_LIST.length === CASES.length && D.CASE_LIST.every((c, i) => c.slug === CASES[i].slug && c.title === CASES[i].title && c.href === `/case-studies/${CASES[i].slug}`), "case-study list matches CASES (slugs, titles, count)");
ok(!/\bslug:\s*"/.test(read("lib/declaration.ts")), "declaration.ts holds no hand-typed case slugs");
ok(D.COURSES.every((c) => CASES.some((x) => x.slug === c.caseSlug)), "both course cards point at a real case study");
ok(JSON.stringify(D.COURSES.map((c) => c.caseSlug)) === JSON.stringify(["trading-app", "sales-coaching-course"]), "the two courses are the trading and sales case studies");

// courses: links null -> waitlist
ok(D.COURSE_LINKS.trading === "https://learn-trading.titanos.tech" && D.COURSE_LINKS.sales === "https://learn-sales.titanos.tech", "COURSE_LINKS hold the decided sign-up URLs");
ok(Object.values(D.COURSE_LINKS).every((u) => u === null || /^https:\/\/[a-z0-9.-]+\.titanos\.tech$/.test(u)), "course links are https on titanos.tech or null");
const parts = read("components/declaration/Parts.tsx");
ok(/courseAction\(c\)/.test(parts) && /Join the waitlist/.test(parts) && /act\.tag/.test(parts), "course card renders from courseAction and keeps the waitlist branch");
for (const c of D.COURSES) {
  const none = D.courseAction(c, { trading: null, sales: null });
  ok(none.kind === "waitlist" && none.tag === `course-${c.caseSlug}` && none.source === "declaration-waitlist", `${c.id}: null link -> waitlist tagged course-${c.caseSlug}`);
  ok(D.courseAction(c, { trading: "https://x.titanos.tech", sales: "https://x.titanos.tech" }).kind === "link", `${c.id}: a URL -> sign-up link`);
  ok(/^course-[a-z0-9-]{1,40}$/.test(none.tag), `${c.id}: waitlist tag is accepted by the backend tag pattern`);
}
ok(D.COURSES.map((c) => c.title).join("|") === "Trading platform (includes the AI course)|Sales course", "course card titles are Kyle's wording");

// mailing list contract
ok(D.CONSENT_LINE === "Daily artifacts from TITANOS. Unsubscribe any time.", "consent line is exact");
const form = read("components/declaration/SubscribeForm.tsx");
ok(/consent: true/.test(form) && /website/.test(form) && /SUBSCRIBE_ENDPOINT/.test(form), "form posts consent, honeypot and the endpoint constant");
ok(/\/v1\/subscribe$/.test(D.SUBSCRIBE_ENDPOINT) && /api\.titanos\.tech/.test(read("app/layout.tsx")), "endpoint host is allowed by the site CSP connect-src");
ok(/"\/v1\/subscribe"/.test(read("portal-api/src/index.ts")) && fs.existsSync("portal-api/migrations/0026_subscribers.sql"), "backend route and migration exist");

// popup source contract
const pop = read("components/declaration/DeclarationPopup.tsx");
ok(/role="dialog"/.test(pop) && /aria-modal="true"/.test(pop) && /aria-labelledby/.test(pop), "popup is a modal dialog with a label");
ok(/e\.key === "Escape"/.test(pop) && /e\.key !== "Tab"/.test(pop) && /\.focus\(\)/.test(pop), "popup closes on Esc, traps Tab and manages focus");
ok(/aria-label="Close the declaration"/.test(pop) && /data-close/.test(pop), "popup has an X close button");
ok(/try \{ return window\.localStorage/.test(pop) && /try \{ window\.localStorage\.setItem/.test(pop) && /catch/.test(pop), "localStorage reads and writes are wrapped in try/catch");
ok(/navigator\.webdriver === true/.test(pop) && /declaration"\) !== "show"/.test(pop), "popup stands down for automation unless ?declaration=show");
ok(/DECLARATION_PATH/.test(pop) && /onDeclaration/.test(pop), "popup is suppressed on /declaration");
ok(/prefers-reduced-motion: reduce/.test(read("components/declaration/declaration.module.css")), "entrance motion is switched off for reduced motion");

// the popup is the whole declaration: every item of Kyle's spec is in it (2026-11-10 brief)
ok(!fs.existsSync("components/ProofDeclaration.tsx") && !/ProofDeclaration/.test(read("app/layout.tsx")), "the old Proof Declaration pop-up is gone from the layout");
for (const [name, re] of [["lead-magnet framing", /data-lead-magnet/], ["key achievements", /<Achievements \/>/], ["AI engineering capability (cost, speed, quality, tests, security, hardware)", /<Capability \/>/], ["subscription prices", /<Prices \/>/], ["case studies", /<CaseList \/>/], ["guide on how we do it", /<Method \/>/], ["both course sign-ups", /<CourseCards \/>/], ["mailing list sign-up", /<SubscribeForm /], ["downloadable PDF", /<PdfButton/], ["sources appendix", /<Appendix \/>/]]) ok(re.test(pop), `popup contains: ${name}`);
ok(["Cost", "Speed", "Quality", "Tests and automated testing", "Security", "Hardware"].every((g) => D.CAPABILITY.some((x) => x.title === g)), "capability covers cost, speed, quality, tests, security, hardware");
ok(!/limit=\{/.test(pop), "popup does not truncate the achievements list");
ok(/declaration\/DeclarationPopup/.test(read("components/DeferredShell.tsx")), "popup is mounted through the deferred shell (own chunk)");

// PDF: present, a real PDF, and generated from the current source text
const pdf = path.join("public", "declaration", D.PDF_NAME);
ok(fs.existsSync(pdf) && fs.readFileSync(pdf).subarray(0, 5).toString() === "%PDF-" && fs.statSync(pdf).size > 20000, "PDF exists and is a PDF");
ok(read("scripts/declaration_pdf.sha256").trim() === createHash("sha256").update(text).digest("hex"), "PDF was generated from the current declaration text (re-run scripts/gen_declaration_pdf.mjs if this fails)");
ok(D.PDF_PATH === "/declaration/" + D.PDF_NAME, "PDF path constant matches the file");

// built output
const bi = process.argv.indexOf("--built");
if (bi > -1) {
  const out = process.argv[bi + 1] || "out";
  const page = path.join(out, "declaration", "index.html");
  const alt = path.join(out, "declaration.html");
  const f = fs.existsSync(page) ? page : alt;
  ok(fs.existsSync(f), "build output has /declaration");
  if (fs.existsSync(f)) {
    const html = read(f);
    ok(html.includes(D.HEADLINE) && html.includes(D.COURSE_LINKS.trading) && html.includes(D.COURSE_LINKS.sales) && html.includes(D.CONSENT_LINE.replace("TITANOS.", "TITANOS.")), "built page has headline, both course sign-up links and consent line");
    for (const c of CASES) ok(html.includes(`/case-studies/${c.slug}`), `built page links case study ${c.slug}`);
    ok(html.includes(D.PDF_PATH), "built page links the PDF");
    ok(!/[–—]/.test(html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "")), "built page body has no em or en dash");
    ok(!IP.test(html.replace(/<script[\s\S]*?<\/script>/g, "")), "built page has no IP address");
    ok(!/robots[^>]*noindex/i.test(html), "built page is indexable");
  }
  ok(fs.existsSync(path.join(out, "declaration", D.PDF_NAME)), "build output carries the PDF");
  const sm = fs.existsSync(path.join(out, "sitemap.xml")) ? read(path.join(out, "sitemap.xml")) : "";
  ok(sm.includes("/declaration"), "sitemap lists /declaration");
}
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
