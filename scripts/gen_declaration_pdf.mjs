// Generates public/declaration/TITANOS_Declaration_2026-11.pdf from lib/declaration.ts (the one content source).
// Usage: node --experimental-strip-types scripts/gen_declaration_pdf.mjs   (needs playwright + its chromium; run by hand, the PDF is committed)
// It also writes scripts/declaration_pdf.sha256, the hash of declarationText(); scripts/test_declaration.mjs fails when the
// source text changes and the PDF was not regenerated, so the PDF can never drift from the page.
import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const D = await import(new URL("../lib/declaration.ts", import.meta.url).href);
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ul = (items) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
const SITE = "https://titanos.tech";

export function printHtml() {
  const caseHtml = D.CASE_LIST.map((c) => `<div class="card"><p class="meta">${esc(c.sector)} · ${esc(c.label)}</p><p class="ct">${esc(c.title)}</p><ul>${c.facts.map(([v, t]) => `<li><b>${esc(v)}</b> ${esc(t)}</li>`).join("")}</ul><p class="meta">${SITE}${esc(c.href)}</p></div>`).join("");
  const courses = D.COURSES.map((c) => {
    const a = D.courseAction(c); const url = a.kind === "link" ? a.url : null;
    return `<div class="card"><p class="ct">${esc(c.title)}</p><p>${esc(c.blurb)}</p><p class="meta">${url ? `Sign up: ${esc(url)}` : `Join the waitlist at ${SITE}${D.DECLARATION_PATH}#courses`}. Case study: ${SITE}/case-studies/${esc(c.caseSlug)}</p></div>`;
  }).join("");
  const rows = D.FIGURES.map((f) => `<tr><td>${esc(f.value)}</td><td>${esc(f.status)}</td><td>${esc(f.source)}. ${esc(f.method)}</td><td>${esc(f.asOf)}</td></tr>`).join("");
  return `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><title>${esc(D.HEADLINE)} | TITANOS</title><style>
@page { size: 130mm 230mm; margin: 11mm 9mm 13mm; }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; line-height: 1.55; color: #111; margin: 0; }
h1 { font-family: Georgia, serif; font-size: 25pt; line-height: 1.12; margin: 4mm 0 4mm; color: #6b5410; }
h2 { font-family: Georgia, serif; font-size: 15pt; margin: 8mm 0 2mm; color: #6b5410; border-bottom: 0.4mm solid #d4af37; padding-bottom: 1mm; break-after: avoid; }
h3 { font-size: 11pt; margin: 4mm 0 1mm; break-after: avoid; }
p { margin: 0 0 2.5mm; } ul, ol { margin: 0 0 3mm; padding-left: 5mm; } li { margin-bottom: 1.2mm; }
.meta { font-size: 8.5pt; color: #555; margin: 0 0 1mm; word-break: break-all; }
.card { border: 0.3mm solid #ccc; border-radius: 1.5mm; padding: 3mm; margin: 0 0 3mm; break-inside: avoid; } .ct { font-weight: 700; margin: 0 0 1.5mm; }
table { width: 100%; border-collapse: collapse; font-size: 8pt; } th, td { text-align: left; vertical-align: top; border-bottom: 0.2mm solid #ccc; padding: 1.2mm 1mm; } td:nth-child(3) { word-break: break-word; }
.small { font-size: 8.5pt; color: #444; } a { color: #6b5410; }
</style></head><body>
<p class="meta">TITANOS · Declaration · ${esc(D.DECLARATION_DATE)}</p>
<h1>${esc(D.HEADLINE)}</h1>
${D.WHO.map((w) => `<p>${esc(w)}</p>`).join("")}
<p class="small">Online version: ${SITE}${D.DECLARATION_PATH}</p>
<h2>Key achievements</h2>${ul(D.ACHIEVEMENTS)}
<h2>AI engineering capability</h2>${D.CAPABILITY.map((g) => `<h3>${esc(g.title)}</h3>${ul(g.points)}`).join("")}
<h2>Subscriptions and prices</h2><ul>${D.SUBSCRIPTIONS.map((r) => `<li><b>${esc(r.name)}</b>: ${esc(r.price)} <span class="meta">${SITE}${esc(r.href)}</span></li>`).join("")}</ul><p class="small">${esc(D.SUBSCRIPTIONS_NOTE)}</p>
<h2>Case studies</h2>${caseHtml}<p class="small">${esc(D.CASES_NOTE)}</p>
<h2>How we do it</h2><ol>${D.METHOD.map((m) => `<li><b>${esc(m.title)}.</b> ${esc(m.text)}</li>`).join("")}</ol><p>${esc(D.METHOD_NOTE)}</p>
<h2>Courses</h2>${courses}
<h2>Daily artifacts</h2><p>Join the mailing list at ${SITE}${D.DECLARATION_PATH}#daily-artifacts</p><p class="small">${esc(D.CONSENT_LINE)}</p>
<h2>Appendix: sources for every number</h2><p class="small">${esc(D.APPENDIX_INTRO)}</p>
<table><thead><tr><th>Figure</th><th>Status</th><th>Source and method</th><th>Date</th></tr></thead><tbody>${rows}</tbody></table>
<p class="small">${esc(D.APPENDIX_CASES)}</p><p class="small">${esc(D.STILL_UNKNOWN)}</p>
</body></html>`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { chromium } = await import("playwright");
  const out = resolve(root, "public/declaration", D.PDF_NAME);
  mkdirSync(dirname(out), { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent(printHtml(), { waitUntil: "load" });
  await p.pdf({ path: out, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: true, headerTemplate: "<span></span>",
    footerTemplate: `<div style="font-size:7pt;width:100%;text-align:center;color:#666;font-family:Arial">titanos.tech/declaration · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>` });
  await b.close();
  const hash = createHash("sha256").update(D.declarationText()).digest("hex");
  writeFileSync(resolve(root, "scripts/declaration_pdf.sha256"), hash + "\n");
  console.log("wrote", out, "content sha256", hash);
}
