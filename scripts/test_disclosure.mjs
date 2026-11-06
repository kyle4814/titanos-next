// C9 disclosure gate: /security page + /.well-known/security.txt agree, both generated from lib/site-data/disclosure.json.
// Kill test: a mutant that drops Expires or changes the contact in ONE place must fail. Run: node scripts/test_disclosure.mjs
import { readFileSync, existsSync } from "node:fs";
import { render } from "./gen_security_txt.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const root = new URL("../", import.meta.url);
const P = (p) => new URL(p, root);
const R = (p) => readFileSync(P(p), "utf8");
const DASH = /[–—]/;
const DAY = 86400000;
const NOW = process.env.DISCLOSURE_NOW ? Date.parse(process.env.DISCLOSURE_NOW) : Date.now();
const BANNED = /\b(audited|audit report|certified|certification|accredited|SOC ?2|ISO ?27001|penetration[- ]tested|bug bounty|bounty|immunity|guaranteed secure|100% secure|unhackable)\b/i;
const ADDR = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

// checks(files, now) -> list of failures. files = { json, txt, page, layout, sources } so mutants run in memory, never on disk.
function checks(f, now = NOW) {
  const bad = [];
  const d = JSON.parse(f.json);
  const copy = d.sections.map((s) => s.body).join("\n");
  const fields = {};
  for (const line of f.txt.split("\n")) { const m = line.match(/^([A-Za-z-]+):\s*(.+)$/); if (m) fields[m[1]] = m[2].trim(); }
  for (const k of ["Contact", "Expires", "Policy", "Preferred-Languages", "Canonical"]) if (!fields[k]) bad.push(`security.txt missing ${k}`);
  if (f.txt !== render(d)) bad.push("security.txt differs from the generator output (page data and file disagree)");
  const exp = Date.parse(fields.Expires || "");
  if (!Number.isFinite(exp)) bad.push("Expires is not a date");
  else if (exp <= now) bad.push("Expires is in the past (stale)");
  else if (exp - now > 365 * DAY) bad.push("Expires is more than 365 days away (RFC 9116 advises under a year)");
  if (!/^https:\/\//.test(fields.Canonical || "") || !/^https:\/\//.test(fields.Policy || "")) bad.push("Canonical and Policy must be https URLs");
  const mail = (fields.Contact || "").replace(/^mailto:/, "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) bad.push("Contact is not a mailto address");
  if (!f.layout.includes(mail)) bad.push(`Contact ${mail} is not an address already on the site (app/layout.tsx)`);
  if (!f.page.includes("disclosure.securityTxt.contact")) bad.push("page does not render the security.txt contact from disclosure.json");
  if (!copy.includes(mail)) bad.push("page copy does not name the same contact as security.txt");
  if ((copy.match(ADDR) || []).some((a) => a !== mail)) bad.push("page copy names a different address from security.txt");
  for (const s of d.sections) {
    const src = f.sources[s.source];
    if (src === undefined || !src.includes(s.needle)) bad.push(`section ${s.id}: ${s.source} does not contain the cited text`);
  }
  if (BANNED.test(copy)) bad.push("copy contains audit, certification, bounty or immunity wording: " + copy.match(BANNED)[0]);
  if (DASH.test(f.json) || DASH.test(f.page) || DASH.test(f.txt)) bad.push("em or en dash present");
  for (const s of d.sections) if (/\d/.test(s.body) && !/\bTARGET\b/.test(s.body)) bad.push(`section ${s.id}: a number with no TARGET label`);
  const tg = d.sections.find((s) => s.id === "targets");
  if (!tg || !/\bTARGET\b/.test(tg.body) || !/not measured/i.test(tg.body)) bad.push("response times must be labelled TARGET and say they are not measured");
  return bad;
}

const json = R("lib/site-data/disclosure.json");
const d0 = JSON.parse(json);
const sources = Object.fromEntries([...new Set(d0.sections.map((s) => s.source))].map((p) => [p, existsSync(P(p)) ? R(p) : undefined]));
const live = { json, txt: R("public/.well-known/security.txt"), page: R("app/security/page.tsx"), layout: R("app/layout.tsx"), sources };
const base = checks(live);
ok(base.length === 0, "live files pass every disclosure check" + (base.length ? " :: " + base.join(" | ") : ""));
const mail = d0.securityTxt.contact.replace(/^mailto:/, "");
ok(live.txt.includes(`Contact: ${d0.securityTxt.contact}`) && live.page.includes("disclosure.securityTxt.contact"), "page and file read the same contact");

// mutants: each must be caught
const mut = (name, fn) => { const m = structuredClone(live); fn(m); const r = checks(m); ok(r.length > 0, `mutant caught: ${name}` + (r.length ? ` (${r[0]})` : " :: SURVIVED")); };
for (const k of ["Expires", "Contact", "Policy", "Canonical", "Preferred-Languages"]) mut(`drop ${k} from security.txt`, (m) => { m.txt = m.txt.replace(new RegExp(`^${k}:.*\\n`, "m"), ""); });
mut("change the contact in security.txt only", (m) => { m.txt = m.txt.replace(/^Contact:.*$/m, "Contact: mailto:other@titanos.tech"); });
mut("change the contact in disclosure.json only", (m) => { m.json = m.json.split(mail).join("other@titanos.tech"); });
mut("change the contact in the copy only", (m) => { const d = JSON.parse(m.json); d.sections[0].body = d.sections[0].body.split(mail).join("other@titanos.tech"); m.json = JSON.stringify(d); });
mut("Expires in the past", (m) => { m.txt = m.txt.replace(/^Expires:.*$/m, "Expires: 2025-01-01T00:00:00.000Z"); });
mut("Expires beyond 365 days", (m) => { m.txt = m.txt.replace(/^Expires:.*$/m, "Expires: 2099-01-01T00:00:00.000Z"); });
mut("add a bounty promise", (m) => { m.json = m.json.replace("We do not run a paid reward programme.", "We pay a bounty for every report."); });
mut("add a certification claim", (m) => { m.json = m.json.replace("It makes no claim about outside review", "We are certified and audited"); });
mut("number with no TARGET label", (m) => { m.json = m.json.replace("TARGET, not a measurement: ", ""); });
mut("cited text gone from its source", (m) => { m.sources["app/security/page.tsx"] = ""; });
mut("em dash in copy", (m) => { m.json = m.json.replace("A short note is fine.", "A short note — is fine."); });
mut("page stops rendering the contact", (m) => { m.page = m.page.replace(/disclosure\.securityTxt\.contact/g, "x"); });
// stale: the untouched live files must fail once the clock passes Expires, and must fail when the clock is a year or more before it
ok(checks(live, Date.parse(d0.securityTxt.expires) + DAY).length > 0, "stale: the live file fails the day after Expires");
ok(checks(live, Date.parse(d0.securityTxt.expires) - 366 * DAY).length > 0, "far future Expires fails (more than 365 days)");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
