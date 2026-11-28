// SPF builder gate: record building, lookup counting, fault detection, provider table honesty, and page source lints.
// Runs without a Next build (the page is checked from source). Usage: node --experimental-strip-types --no-warnings scripts/test_spf_builder.mjs
import fs from "node:fs";
import { PROVIDERS, buildRecord, analyse, parseTerms } from "../app/tools/spf-builder/spf.ts";
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail = 1; };
const lv = (r) => analyse(r).level;
const has = (r, re) => analyse(r).findings.some((f) => re.test(f.text));

// build
ok(buildRecord({ providerIds: ["google"], policy: "~all" }) === "v=spf1 include:_spf.google.com ~all", "Google only matches Google's published example");
ok(buildRecord({ providerIds: ["microsoft"], policy: "-all" }) === "v=spf1 include:spf.protection.outlook.com -all", "Microsoft only matches Microsoft's published example");
ok(buildRecord({ providerIds: ["xero", "servicem8"], policy: "~all" }) === "v=spf1 ~all", "providers with no published include add nothing");
ok(buildRecord({ providerIds: ["google", "google"], extraIncludes: ["_SPF.google.com"], policy: "~all" }) === "v=spf1 include:_spf.google.com ~all", "duplicate includes collapse");
ok(buildRecord({ providerIds: [], ip4: ["203.0.113.10"], ip6: ["2001:db8::/32"], useMx: true, policy: "-all" }) === "v=spf1 mx ip4:203.0.113.10 ip6:2001:db8::/32 -all", "mx, ip4, ip6 order and policy");

// counting
const c = (r) => analyse(r).lookups;
ok(c("v=spf1 include:a.com include:b.com ~all") === 2, "two includes = 2");
ok(c("v=spf1 ip4:1.2.3.4 ip4:5.6.7.0/24 ip6:2001:db8::/32 -all") === 0, "ip4/ip6/all cost nothing");
ok(c("v=spf1 a mx exists:x.com ptr redirect=y.com") === 5, "a, mx, exists, ptr, redirect cost one each");
ok(c("v=spf1 a:mail.x.com mx:x.com/24 ~all") === 2, "a:/mx: with arguments counted");
const ten = "v=spf1 " + Array.from({ length: 10 }, (_, i) => `include:s${i}.com`).join(" ") + " ~all";
const eleven = ten.replace("~all", "include:s10.com ~all");
ok(c(ten) === 10 && !has(ten, /limit is 10/), "10 lookups is at the limit, not over");
ok(c(eleven) === 11 && lv(eleven) === "fail" && has(eleven, /limit is 10/), "11 lookups fails with the limit message");
const nine = "v=spf1 " + Array.from({ length: 9 }, (_, i) => `include:s${i}.com`).join(" ") + " ~all";
ok(lv(nine) === "warn" && has(nine, /nested/), "9 lookups warns that nested includes may push it over");
ok(lv("v=spf1 include:_spf.google.com ~all") === "ok", "plain Google record is ok");

// faults
ok(lv("v=spf1 include:a.com +all") === "fail" && has("v=spf1 include:a.com +all", /everyone|every server/), "+all fails");
ok(lv("v=spf1 include:a.com all") === "fail", "bare all (means +all) fails");
ok(lv("v=spf1 include:a.com ?all") === "warn", "?all warns");
ok(lv("v=spf1 include:a.com") === "warn" && has("v=spf1 include:a.com", /No all term/), "missing all warns");
ok(lv("v=spf1 include=a.com ~all") === "fail", "include= (equals) fails");
ok(lv("v=spf1 include: a.com ~all") === "fail", "space after colon fails");
ok(has("v=spf1 include:a.com. ~all", /full stop/), "trailing full stop flagged");
ok(lv("include:a.com ~all") === "fail" && has("include:a.com ~all", /start with v=spf1/), "missing v=spf1 fails");
ok(has("v=spf1 include:a.com ~all v=spf1 include:b.com ~all", /two SPF records/), "two records flagged");
ok(has("v=spf1 ptr ~all", /ptr/), "ptr discouraged");
ok(has("v=spf1 include:a.com include:A.com ~all", /twice/), "duplicate include flagged case-insensitively");
ok(has("v=spf1 ~all include:a.com", /after all/), "terms after all flagged");
ok(has("v=spf1 " + "ip4:203.0.113.10 ".repeat(20) + "~all", /255/), "over 255 bytes warned");
ok(analyse("").lookups === 0 && analyse("").findings.length === 1, "empty input is handled");
ok(parseTerms("v=spf1 -all").length === 2, "parked-domain record parses");
ok(lv("v=spf1 -all") === "ok", "parked-domain record v=spf1 -all is ok");
ok(lv("V=SPF1 INCLUDE:a.com ~ALL") === "ok", "case-insensitive");

// provider table honesty: every include must be from a real source and none may be invented
for (const p of PROVIDERS) {
  ok(/^https:\/\//.test(p.source.url), `${p.id} has an https source`);
  ok(p.status !== "none-published" ? !!p.include : p.include === null, `${p.id} status matches include`);
  ok(!/[–—]/.test(p.note + p.use + p.name), `${p.id} copy has no dashes`);
}
const byId = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]));
ok(byId.google.include === "_spf.google.com" && byId.google.status === "provider-doc", "Google include verified from Google docs 2026-11-29");
ok(byId.microsoft.include === "spf.protection.outlook.com" && byId.microsoft.status === "provider-doc", "Microsoft include verified from Microsoft Learn 2026-11-29");
ok(byId.mailchimp.status === "third-party", "Mailchimp include labelled third-party, not provider-documented");
ok(byId.xero.include === null && byId.servicem8.include === null, "Xero and ServiceM8 carry no invented include");
for (const id of ["google", "microsoft", "mailchimp", "xero", "servicem8"]) ok(!!byId[id], `provider ${id} present`);

// page source lints
const src = ["page.tsx", "SpfBuilder.tsx", "spf.ts"].map((f) => fs.readFileSync(new URL(`../app/tools/spf-builder/${f}`, import.meta.url), "utf8"));
const page = src[0];
const title = /const TITLE = "([^"]*)"/.exec(page)?.[1] ?? "";
const desc = /const DESC = "([^"]*)"/.exec(page)?.[1] ?? "";
ok(title.length > 0 && title.length <= 60, `title ${title.length} chars`);
ok(desc.length >= 140 && desc.length <= 160, `description ${desc.length} chars`);
ok(page.includes('const PATH = "/tools/spf-builder"'), "path");
ok((page.match(/<h1[ >]/g) || []).length === 1 && /SPF record builder/.test(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(page)?.[1] ?? ""), "one h1 with the target term");
for (const t of ["WebApplication", "faqPage", "breadcrumbs"]) ok(page.includes(t), `JSON-LD ${t}`);
const all = src.join("\n");
ok(!/[–—]/.test(all), "no em or en dash in source");
ok(!/\b(delve|leverage|robust|holistic|landscape|cutting-edge|ecosystem|streamline|synergy)\b/i.test(all), "no AI-tell words");
for (const h of ["/tools/email-spoofing-check", "/guides/email-security-small-business-australia", "/products/dmarc-setup-guide", "/tools"]) ok(page.includes(`"${h}"`) || page.includes(`href="${h}"`), `links to ${h}`);
for (const h of ["/tools/email-spoofing-check", "/guides/email-security-small-business-australia", "/products/dmarc-setup-guide"]) {
  const slug = h.split("/").pop();
  const hit = h.startsWith("/tools/") ? fs.existsSync(new URL(`../app${h}/page.tsx`, import.meta.url)) : fs.readFileSync(new URL(`../lib/seo-links.ts`, import.meta.url), "utf8").includes(slug);
  ok(hit, `link target exists: ${h}`);
}
ok(fs.existsSync(new URL("../app/tools/spf-builder/SpfBuilder.tsx", import.meta.url)) && /^"use client"/.test(src[1]), "client component marked use client");
ok(!/\bfetch\(|XMLHttpRequest|localStorage|sessionStorage/.test(src[1] + src[2]), "no network or storage calls in the tool");
console.log(fail ? "FAIL" : "ALL PASS");
process.exit(fail);
