// f279 white-label reports: node --experimental-strip-types scripts/test_white_label.mjs [--built out]
// Checks the brand-token validator bites, the sample is synthetic, labelled, deterministic and offline, the page
// wiring exists, and the client copy is content_lint --no-cta CLEAN with no em or en dash. No send, no upload.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { validateBrand, contrast, onAccent, brandVars, buildSampleReport, SAMPLE_BRAND, SAMPLE_DOMAIN } from "../lib/whiteLabel.ts";
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const DASH = /[–—]/;
const good = SAMPLE_BRAND;

// 1. Validator accepts the sample and rejects each fault (mutations).
ok(validateBrand(good).ok, "sample brand validates");
const bad = (patch, code) => { const r = validateBrand({ ...good, ...patch }); ok(!r.ok && r.errors.includes(code) && r.brand === null, `rejects ${code}`); };
bad({ accent: "red" }, "accent_must_be_hex");
bad({ accent: "#12345" }, "accent_must_be_hex");
bad({ ink: "#123456; background:url(//evil)" }, "ink_must_be_hex");
bad({ paper: "javascript:alert(1)" }, "paper_must_be_hex");
bad({ partnerName: "" }, "partner_name_required");
bad({ partnerName: "x".repeat(41) }, "partner_name_too_long");
bad({ partnerName: "<script>alert(1)</script>" }, "partner_name_not_plain_text");
bad({ ink: "#CCCCCC", paper: "#FFFFFF" }, "ink_on_paper_below_aa");
bad({ logoSlot: { label: "Logo", width: 9000, height: 56 } }, "logo_slot_size_out_of_range");
ok(!validateBrand(null).ok && !validateBrand(undefined).ok, "null and undefined brand rejected, no throw");
ok(contrast("#000000", "#ffffff") === 21, "contrast black on white is 21");
ok(onAccent("#1F6FEB") === "#ffffff" && onAccent("#FFD400") === "#000000", "badge text colour flips for dark and light accents");
ok(contrast(onAccent(good.accent), good.accent) >= 4.5, "sample grade badge reaches AA");
const v = brandVars(good);
ok(v["--wl-accent"] === good.accent && v["--wl-ink"] === good.ink && v["--wl-paper"] === good.paper, "brand colours become CSS custom properties");

// 2. Sample report: synthetic, labelled, deterministic, offline, produced by the real scanner.
const a = await buildSampleReport(), b = await buildSampleReport();
ok(JSON.stringify(a) === JSON.stringify(b), "sample report is deterministic");
ok(a.synthetic === true && /^SYNTHETIC SAMPLE/.test(a.label), "labelled SYNTHETIC SAMPLE");
ok(a.scan.domain === SAMPLE_DOMAIN && SAMPLE_DOMAIN.endsWith(".example"), "domain is the reserved .example name");
ok(a.scan.modelCalls === 0, "zero model calls");
ok(a.scan.findings.length === 6 && a.scan.findings.some((f) => f.status === "FAIL" || f.status === "WARN"), "six controls scanned, at least one needs a fix");
ok(a.plan.steps.length > 0 && a.plan.steps.length === a.scan.findings.filter((f) => f.status === "FAIL" || f.status === "WARN").length, "fix plan has one step per failing control");
let threw = false; try { await buildSampleReport({ ...good, accent: "nope" }); } catch (e) { threw = /invalid_brand/.test(String(e)); }
ok(threw, "an invalid brand cannot build a report");

// 3. Wiring and honesty (source).
const comp = fs.readFileSync("components/WhiteLabelReport.tsx", "utf8");
const page = fs.readFileSync("app/pro/page.tsx", "utf8");
const anchors = fs.readFileSync("app/pro/anchors.ts", "utf8");
ok(/data-wl-logo-slot/.test(comp) && /--wl-accent/.test(comp), "component has the logo slot and reads brand tokens");
ok(!/<img|next\/image|fetch\(|input type="file"|"use client"/.test(comp), "no image load, fetch, file upload or client code");
ok(/extras=\{\{ "white-label-reports": <WhiteLabelReport \/> \}\}/.test(page) && (page.match(/<SeatAnchors /g) || []).length === 1, "pro page renders the sample inside the white-label-reports section");
ok(/id: "white-label-reports"[^}]*status: "coming"/s.test(anchors), "anchor marker stays 'coming': the feature is not switched on");
ok(/invented data/.test(anchors) && /Nothing is sent/.test(anchors), "anchor copy says the sample is invented and nothing is sent");
for (const [n, c] of [["lib/whiteLabel.ts", fs.readFileSync("lib/whiteLabel.ts", "utf8")], ["components/WhiteLabelReport.tsx", comp], ["app/pro/anchors.ts", anchors]]) ok(!DASH.test(c), `${n} has no em or en dash`);
ok(!/anthropic|openai|sk_live|sk_test|whsec_|stripe/i.test(comp + fs.readFileSync("lib/whiteLabel.ts", "utf8")), "no model, Stripe or secret reference");

// 4. Client copy lint.
const text = [a.label, a.dateLabel, SAMPLE_BRAND.logoSlot.label, ...a.scan.findings.map((f) => f.detail), ...a.plan.steps.map((s) => s.title), (anchors.match(/id: "white-label-reports"[\s\S]*?body: "([^"]*)"/) || [])[1]].join("\n\n");
ok(!DASH.test(text), "rendered copy has no em or en dash");
const lint = "/home/tech2/klinge-kernel/bin/content_lint.py";
if (fs.existsSync(lint)) {
  const tmp = fs.mkdtempSync("/tmp/f279-lint-"); const f = path.join(tmp, "copy.txt");
  fs.writeFileSync(f, text + "\n");
  const r = spawnSync("python3", [lint, "--no-cta", f], { encoding: "utf8" });
  ok(r.status === 0, "content_lint --no-cta CLEAN" + (r.status ? " :: " + (r.stdout + r.stderr).slice(0, 400) : ""));
  fs.rmSync(tmp, { recursive: true, force: true });
} else console.log("NOTE content_lint absent, lint check skipped");

// 5. Built HTML (optional).
const bi = process.argv.indexOf("--built");
if (bi > 0) {
  const out = process.argv[bi + 1]; const f = [path.join(out, "pro.html"), path.join(out, "pro/index.html")].find(fs.existsSync);
  ok(!!f, "/pro exported");
  if (f) {
    const html = fs.readFileSync(f, "utf8");
    ok((html.match(/<section[^>]* id="white-label-reports"/g) || []).length === 1, "section id appears once");
    ok(/data-wl-logo-slot/.test(html) && /data-wl-report/.test(html) && /--wl-accent:#1F6FEB/i.test(html), "sample report and brand tokens are in the exported HTML");
    ok(/SYNTHETIC SAMPLE/.test(html), "label present in exported HTML");
  }
}
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
