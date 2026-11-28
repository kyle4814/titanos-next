// Unit test for lib/emailSpoofCheck.ts with a mocked DNS-over-HTTPS fetcher (no network).
// Run: node --experimental-strip-types --no-warnings scripts/test_email_spoof_check.mjs
import assert from "node:assert/strict";
import { normaliseDomain, organisationalDomain, unquoteTxt, runCheck, parseDmarcTags, parseSpfTerms } from "../lib/emailSpoofCheck.ts";

const zone = (records) => async (url) => {
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, "https://cloudflare-dns.com/dns-query");
  const name = u.searchParams.get("name");
  const type = u.searchParams.get("type");
  if (records.__fail && records.__fail(name)) return { ok: false, status: 500, json: async () => ({}) };
  const key = `${type}:${name}`;
  const data = records[key];
  const answers = (data || []).map((d) => ({ name, type: type === "MX" ? 15 : 16, TTL: 60, data: d }));
  return { ok: true, status: 200, json: async () => ({ Status: data ? 0 : 3, Answer: answers.length ? answers : undefined }) };
};

// input handling
assert.equal(normaliseDomain("https://www.Example.com.au/path?x=1"), "www.example.com.au");
assert.equal(normaliseDomain("kyle@example.com.au"), "example.com.au");
assert.equal(normaliseDomain("not a domain"), null);
assert.equal(normaliseDomain("localhost"), null);
assert.equal(normaliseDomain("192.168.0.1"), null);
assert.equal(organisationalDomain("mail.shop.example.com.au"), "example.com.au");
assert.equal(organisationalDomain("a.example.com"), "example.com");
assert.equal(unquoteTxt('"v=spf1 include:a" " -all"'), "v=spf1 include:a -all");
assert.equal(parseDmarcTags("v=DMARC1; p=reject; pct=50").pct, "50");
assert.equal(parseSpfTerms("v=spf1 include:a.com mx ~all").lookupTerms, 2);

// protected
let r = await runCheck("good.com.au", zone({
  "TXT:good.com.au": ['"v=spf1 include:_spf.google.com -all"'],
  "TXT:_spf.google.com": ['"v=spf1 ip4:1.2.3.4 -all"'],
  "TXT:_dmarc.good.com.au": ['"v=DMARC1; p=reject; rua=mailto:r@good.com.au"'],
  "TXT:google._domainkey.good.com.au": ['"v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC"'],
  "MX:good.com.au": ["1 aspmx.l.google.com."],
}));
assert.equal(r.verdict.level, "protected");
assert.equal(r.mx.provider, "Google Workspace");

// no dmarc => exposed
r = await runCheck("bad.com.au", zone({ "TXT:bad.com.au": ['"v=spf1 +all"'] }));
assert.equal(r.verdict.level, "exposed");
assert.ok(r.spf.findings.some((f) => /\+all/.test(f.title)));
assert.ok(r.dmarc.findings.some((f) => /No DMARC/.test(f.title)));

// p=none => exposed, never "protected"
r = await runCheck("none.com.au", zone({ "TXT:none.com.au": ['"v=spf1 -all"'], "TXT:_dmarc.none.com.au": ['"v=DMARC1; p=none"'] }));
assert.equal(r.verdict.level, "exposed");

// subdomain inherits parent policy
r = await runCheck("mail.good.com.au", zone({
  "TXT:mail.good.com.au": ['"v=spf1 -all"'],
  "TXT:_dmarc.good.com.au": ['"v=DMARC1; p=quarantine; rua=mailto:r@good.com.au"'],
}));
assert.equal(r.dmarc.source, "good.com.au");
assert.equal(r.dmarc.policy, "quarantine");

// lookup failure => unknown, never a pass
r = await runCheck("down.com.au", zone({ __fail: () => true }));
assert.equal(r.verdict.level, "unknown");

// duplicate SPF flagged
r = await runCheck("dup.com.au", zone({ "TXT:dup.com.au": ['"v=spf1 -all"', '"v=spf1 ~all"'], "TXT:_dmarc.dup.com.au": ['"v=DMARC1; p=reject"'] }));
assert.ok(r.spf.findings.some((f) => /2 SPF records/.test(f.title)));

// invalid input
assert.ok("error" in (await runCheck("???", zone({}))));
console.log("test_email_spoof_check: all assertions passed");
