// Stage paid-product files for delivery from the welcome page (static site, no server).
// Copies each product's files from the kernel product folders to public/dl/<32-hex>/<file> and writes
// lib/products/downloads.json {slug: {dir, files:[{name,label,bytes}]}}. The hex is random per product and is
// reused on re-run (never regenerated), so links already sent stay valid. Linked only from /welcome/<slug>.
// Usage: node scripts/stage_product_downloads.mjs [--src /home/tech2/klinge-kernel/state/products]
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync, readdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argSrc = process.argv.indexOf("--src");
const SRC = argSrc > 0 ? process.argv[argSrc + 1] : "/home/tech2/klinge-kernel/state/products";
const out = join(root, "lib/products/downloads.json");
const prev = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};

const W = "privacy-policy-template-pack/word/";
const MAP = {
  "dmarc-setup-guide": [["dmarc-setup-guide/dmarc-setup-guide.pdf", "The guide (PDF)"]],
  "spoofguard-self-check-checklist": [["spoofguard-self-check-checklist/spoofguard-self-check-checklist.pdf", "The checklist (PDF)"]],
  "essential-eight-ml1-checklist": [["essential-eight-ml1-checklist/essential-eight-ml1-checklist.pdf", "The checklist (PDF)"]],
  "privacy-policy-template-pack": [
    ["privacy-policy-template-pack/privacy-policy-template-pack.pdf", "The full pack (PDF)"],
    [W + "privacy-policy-template-pack-00-start-here.docx", "Start here (Word)"],
    [W + "privacy-policy-template-pack-01-privacy-policy-template.docx", "Privacy policy template (Word)"],
    [W + "privacy-policy-template-pack-02-collection-notices.docx", "Collection notices (Word)"],
    [W + "privacy-policy-template-pack-03-staff-handout.docx", "Staff handout (Word)"],
    [W + "privacy-policy-template-pack-04-annual-review-checklist.docx", "Annual review checklist (Word)"],
  ],
  "privacy-adm-wording-guide": [["privacy-adm-wording-guide/privacy-adm-wording-guide.pdf", "The guide (PDF)"]],
  "five-jurisdiction-privacy-bundle": [["five-jurisdiction-privacy-bundle/five-jurisdiction-privacy-bundle.zip", "The bundle (ZIP: PDF plus Word files)"]],
  "breach-response-runbook": [
    ["breach-response-runbook/breach-response-runbook.pdf", "The runbook (PDF)"],
    ["breach-response-runbook/breach-response-runbook.docx", "The runbook (Word, editable)"],
  ],
  "vendor-risk-register-template": [
    ["vendor-risk-register-template/vendor-risk-register-template.xlsx", "The register (Excel and Google Sheets)"],
    ["vendor-risk-register-template/vendor-risk-register-template.pdf", "Printable companion (PDF)"],
  ],
  "customer-dossier-method-guide": [
    ["customer-dossier-method-guide/customer-dossier-method-guide.pdf", "The guide (PDF)"],
    ["customer-dossier-method-guide/customer-dossier-brief-template.md", "One-page brief template (text)"],
    ["customer-dossier-method-guide/customer-dossier-source-log.csv", "Source log (CSV, opens in Excel)"],
  ],
  "quote-follow-up-playbook": [
    ["quote-follow-up-playbook/quote-follow-up-playbook.pdf", "The playbook (PDF)"],
    ["quote-follow-up-playbook/quote-follow-up-tracker.xlsx", "Tracking sheet (Excel and Google Sheets)"],
  ],
  "invoice-chasing-playbook": [
    ["invoice-chasing-playbook/invoice-chasing-playbook.pdf", "The playbook (PDF)"],
    ["invoice-chasing-playbook/invoice-chasing-tracker.xlsx", "Tracking sheet (Excel and Google Sheets)"],
  ],
  "efficiency-proof-pack": [
    ["efficiency-proof-pack/efficiency-proof-pack.pdf", "The pack (PDF)"],
    ["efficiency-proof-pack/efficiency-time-log.xlsx", "Time log (Excel and Google Sheets)"],
    ["efficiency-proof-pack/efficiency-results-sheet.xlsx", "Results sheet (Excel and Google Sheets)"],
  ],
  "course-ai-for-tradies": [["course-ai-for-tradies/course-ai-for-tradies.zip", "The course bundle (ZIP)"]],
  "course-email-security-for-owners": [["course-email-security-for-owners/course-email-security-for-owners.zip", "The course bundle (ZIP)"]],
};

const res = {};
for (const [slug, files] of Object.entries(MAP)) {
  const hex = prev[slug]?.dir ?? randomBytes(16).toString("hex");
  const dest = join(root, "public/dl", hex);
  mkdirSync(dest, { recursive: true });
  res[slug] = { dir: hex, files: [] };
  for (const [rel, label] of files) {
    const src = join(SRC, rel);
    if (!existsSync(src)) throw new Error(`missing source for ${slug}: ${rel}`);
    const name = basename(rel);
    copyFileSync(src, join(dest, name));
    res[slug].files.push({ name, label, bytes: statSync(src).size });
  }
}
writeFileSync(out, JSON.stringify(res, null, 2) + "\n");
console.log(`staged ${Object.keys(res).length} products, ${Object.values(res).reduce((n, r) => n + r.files.length, 0)} files`);
