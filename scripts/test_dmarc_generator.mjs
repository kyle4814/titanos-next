// Tests for lib/dmarcGenerator.ts and the /tools/dmarc-generator page source (no network, no build needed).
// Run: node --experimental-strip-types --no-warnings scripts/test_dmarc_generator.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildDmarc, cleanDomain, parseReportAddresses } from "../lib/dmarcGenerator.ts";

// domain cleaning
assert.equal(cleanDomain("https://Example.com.au/path"), "example.com.au");
assert.equal(cleanDomain("kyle@example.com.au"), "example.com.au");
assert.equal(cleanDomain("example.com.au."), "example.com.au");
assert.equal(cleanDomain("localhost"), null);
assert.equal(cleanDomain(""), null);
assert.equal(cleanDomain(undefined), null);

// report addresses
assert.deepEqual(parseReportAddresses("a@x.com, mailto:B@y.com.au  a@x.com"), { good: ["a@x.com", "b@y.com.au"], bad: [] });
assert.deepEqual(parseReportAddresses("nope, a@x.com").bad, ["nope"]);
assert.deepEqual(parseReportAddresses("").good, []);

// the monitor-only starter
let r = buildDmarc({ domain: "example.com.au", policy: "none", rua: "dmarc@example.com.au" });
assert.equal(r.valid, true);
assert.equal(r.value, "v=DMARC1; p=none; rua=mailto:dmarc@example.com.au");
assert.equal(r.host, "_dmarc.example.com.au");
assert.deepEqual(r.fields, { type: "TXT", name: "_dmarc.example.com.au", value: r.value });
assert.ok(r.value.startsWith("v=DMARC1; p="), "v first then p (RFC 7489 section 6.3)");
assert.ok(r.notes.some((n) => n.level === "ok"));

// ROLLOUT stage records in lib/dmarcSetup.ts must be reproducible by the generator
const stage2 = buildDmarc({ policy: "quarantine", pct: 10, rua: "dmarc-reports@example.com.au" });
assert.equal(stage2.value, "v=DMARC1; p=quarantine; pct=10; rua=mailto:dmarc-reports@example.com.au");
const stage3 = buildDmarc({ policy: "quarantine", pct: 100, rua: "dmarc-reports@example.com.au" });
assert.equal(stage3.value, "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@example.com.au", "pct=100 is the default and is left out");

// tag order and every option
r = buildDmarc({ domain: "example.com.au", policy: "reject", subPolicy: "quarantine", pct: 50, rua: "a@example.com.au, b@example.com.au", dkim: "s", spf: "s" });
assert.equal(r.value, "v=DMARC1; p=reject; sp=quarantine; pct=50; rua=mailto:a@example.com.au,mailto:b@example.com.au; adkim=s; aspf=s");
r = buildDmarc({ policy: "none", subPolicy: "same", dkim: "r", spf: "r" });
assert.equal(r.value, "v=DMARC1; p=none");
assert.equal(r.host, "_dmarc.yourdomain.com.au");
assert.ok(r.notes.some((n) => n.level === "warn" && /No report address/.test(n.text)));

// validation
r = buildDmarc({ policy: "none", pct: 101 });
assert.equal(r.valid, false);
r = buildDmarc({ policy: "none", pct: -1 });
assert.equal(r.valid, false);
r = buildDmarc({ policy: "none", pct: 12.5 });
assert.equal(r.valid, false);
r = buildDmarc({ policy: "none", rua: "not-an-email" });
assert.equal(r.valid, false);
r = buildDmarc({ policy: "bogus" });
assert.equal(r.valid, false);
r = buildDmarc({ policy: "none", pct: 0 });
assert.equal(r.valid, true);
assert.equal(r.value, "v=DMARC1; p=none; pct=0");

// guidance notes
r = buildDmarc({ policy: "reject", pct: 100, rua: "a@example.com.au" });
assert.ok(r.notes.some((n) => n.level === "warn" && /last stage/.test(n.text)), "warns about jumping to reject");
r = buildDmarc({ domain: "example.com.au", policy: "none", rua: "x@reports.vendor.net" });
assert.ok(r.notes.some((n) => /example\.com\.au\._report\._dmarc\.reports\.vendor\.net/.test(n.text)), "external report domain names the authorisation record");
r = buildDmarc({ domain: "example.com.au", policy: "none", rua: "x@mail.example.com.au" });
assert.ok(!r.notes.some((n) => /_report\._dmarc/.test(n.text)), "same-domain mailbox needs no authorisation record");

// copy: no em or en dashes, no AI-tell words, no invented numbers beyond the RFC range
const dash = /[–—]/;
const tells = /\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|synerg\w*|ecosystem)\b/i;
for (const f of ["lib/dmarcGenerator.ts", "app/tools/dmarc-generator/page.tsx", "app/tools/dmarc-generator/Generator.tsx"]) {
  const t = fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
  assert.ok(!dash.test(t), `${f}: no em or en dashes`);
  assert.ok(!tells.test(t), `${f}: no AI-tell words`);
}

// page source: metadata, links, no network or storage in the client component
const page = fs.readFileSync(new URL("../app/tools/dmarc-generator/page.tsx", import.meta.url), "utf8");
const title = page.match(/const TITLE =\s*"([^"]+)"/)[1];
const desc = page.match(/const DESC =\s*"([^"]+)"/)[1];
assert.ok(title.length <= 65, `title length ${title.length}`);
assert.ok(desc.length >= 120 && desc.length <= 170, `description length ${desc.length}`);
assert.ok(page.includes('const PATH = "/tools/dmarc-generator"'));
assert.ok(page.includes("<RelatedLinks"), "renders RelatedLinks");
for (const href of ["/products/dmarc-setup-guide", "/scan", "/tools/email-spoofing-check"]) {
  assert.ok(page.includes(`href="${href}"`), `links to ${href}`);
  const dir = href.startsWith("/products") ? null : `app${href}/page.tsx`;
  if (dir) assert.ok(fs.existsSync(new URL(`../${dir}`, import.meta.url)), `${href} page exists`);
}
const gen = fs.readFileSync(new URL("../app/tools/dmarc-generator/Generator.tsx", import.meta.url), "utf8");
assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/.test(gen), "client component makes no request and stores nothing");
const { TOOL_RELATED, PRODUCT_LINKS, GUIDE_LINKS } = await import("../lib/seo-links.ts");
const rel = TOOL_RELATED["/tools/dmarc-generator"];
assert.ok(rel, "related map exists");
for (const p of rel.products) assert.ok(PRODUCT_LINKS[p], `product ${p}`);
for (const g of rel.guides) assert.ok(GUIDE_LINKS[g], `guide ${g}`);
assert.ok(fs.readFileSync(new URL("../app/tools/email-spoofing-check/page.tsx", import.meta.url), "utf8").includes("/tools/dmarc-generator"), "spoofing check links to generator");

console.log("PASS test_dmarc_generator");
