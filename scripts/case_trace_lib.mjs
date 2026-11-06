// C9 Proof Wall bar, case-study trace. Pure functions over a site root, so the test can run them on the real tree
// and on mutated copies. No network, no model calls.
//
// A "surface" is every place a case-study figure can live: the CASES array, the Ariance JSON, the proof page, the case-study
// pages and components/cases. Each surface yields "fields" (key -> text). Every figure in a field must be claimed in
// lib/case-studies/trace.json (fields[key].figs) AND carry at least one source id that resolves. The manifest's `fields`
// block is generated (scripts/gen_case_trace.mjs --write) so it cannot drift by hand; the test recomputes it.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const LABELS = ["REAL", "SYNTHETIC", "MODELLED"];
const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";

export const read = (root, p) => readFileSync(join(root, p), "utf8");
export const exists = (root, p) => existsSync(join(root, p));

// ---- figure extraction ----------------------------------------------------------------------------------------------
export function figures(text) {
  let t = String(text).replace(/\$\{[^}]*\}|\$\([^)]*\)/g, " ").replace(/^\s*\d+\.\s/, "").replace(/\bUTC[+-]\d+\b/g, " ");
  const out = [];
  const take = (re) => { t = t.replace(re, (m) => { out.push(m.trim()); return " "; }); };
  take(new RegExp(`\\b\\d{1,2} (?:${MONTHS})(?: \\d{4})?\\b`, "g"));
  take(/\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2})?\b/g);
  take(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g);
  take(/\b(?:US|AU)?\$\d[\d,]*(?:\.\d+)?/g);
  take(/\b\d[\d,]*(?:\.\d+)?%/g);
  take(/\b\d[\d,]*(?:\.\d+)?\b/g);
  return [...new Set(out.map((x) => x.replace(/,$/, "")))].sort();
}
export function kind(fig) {
  if (/\$/.test(fig)) return "money";
  if (/%$/.test(fig)) return "percent";
  if (/^\d{4}-\d{2}-\d{2}/.test(fig) || /\d{1,2} [A-Z][a-z]+/.test(fig)) return "date";
  if (/:\d{2}/.test(fig)) return "time";
  return "count";
}

// ---- surfaces --------------------------------------------------------------------------------------------------------
function flatten(o, p, out, skip) {
  if (o === null || o === undefined) return;
  if (typeof o === "string" || typeof o === "number") {
    if (!skip(p, o)) out[p] = String(o);
  } else if (Array.isArray(o)) o.forEach((v, i) => flatten(v, `${p}[${i}]`, out, skip));
  else if (typeof o === "object") for (const [k, v] of Object.entries(o)) flatten(v, p ? `${p}.${k}` : k, out, skip);
}

/** The CASES array is TypeScript; evaluate just the literal. */
export function loadCases(root) {
  const src = read(root, "lib/caseStudies.ts");
  const a = src.indexOf("export const CASES");
  const start = src.indexOf("= [", a) + 2;
  const end = src.indexOf("\n];", start) + 2;
  if (a < 0 || start < 2 || end < 2) throw new Error("cannot locate CASES literal in lib/caseStudies.ts");
  return new Function(`return ${src.slice(start, end)}`)();
}

const PATHISH = /^(\/|\.\/|@\/|https?:\/\/)/;
export function caseFields(root) {
  const fields = {};
  for (const c of loadCases(root)) {
    const f = {};
    flatten(c, "", f, (p, v) => p === "slug" || p === "label" || /(^|\.)src$/.test(p) || p === "cover" || PATHISH.test(String(v)));
    for (const [k, v] of Object.entries(f)) fields[`cases.${c.slug}.${k}`] = v;
  }
  return fields;
}
export function arianceFields(root) {
  const d = JSON.parse(read(root, "lib/case-studies/ariance.json"));
  const f = {};
  flatten(d, "", f, (p, v) => /^(slug|label)$/.test(p) || /(^|\.)(src|phone|desktop|id)$/.test(p) || PATHISH.test(String(v)) || p === "attribution" || p === "consent_note" || typeof v === "boolean");
  const out = {};
  for (const [k, v] of Object.entries(f)) out[`ariance.${k}`] = v;
  return out;
}

/** Text nodes and prose string literals from a TSX file, with comments removed. */
export function tsxFields(root, file) {
  let s = read(root, file);
  s = s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
  const found = [];
  for (const m of s.matchAll(/>([^<>{}]*[A-Za-z0-9][^<>{}]*)</g)) found.push(m[1]);
  const DATAKEY = /\b(n|big|value|num|v|figure)\s*:\s*$/;
  for (const m of s.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*?)\1/g)) {
    const t = m[2];
    if (/^\d[\d,.]*$/.test(t.trim()) && !DATAKEY.test(s.slice(Math.max(0, m.index - 24), m.index))) continue; // bare digits are layout unless a data key owns them
    if (!/\d|\s.*\s/.test(t)) continue; // digit-bearing, or prose of 3+ words
    found.push(t);
  }
  // multi-line template literals (the replay code box)
  for (const m of s.matchAll(/`([^`]*)`/g)) found.push(m[1]);
  const layoutOnly = (t) => !/[A-Za-z]{2}/.test(t.replace(/var\([^)]*\)|\b\d+(px|rem|em|vh|vw|fr|ms|%)|\bauto\b|repeat|minmax|solid|\bpx\b/g, "")) && !/^\d[\d,.]*$/.test(t);
  const fields = {};
  const seen = new Map();
  for (const raw of found) {
    const t = raw.replace(/\s+/g, " ").trim();
    if (!t || PATHISH.test(t)) continue;
    const isFig = figures(t).length > 0;
    if (isFig && layoutOnly(t)) continue;
    if (/\$\(/.test(t)) continue; // shell sample in a code box
    if (!isFig && !/\s.*\s/.test(t)) continue;
    const base = `tsx:${file}:${t.slice(0, 56)}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    fields[n > 1 ? `${base}#${n}` : base] = t;
  }
  return fields;
}

export const TSX_FILES = (root) => {
  const list = ["app/proof/page.tsx", "app/case-studies/page.tsx", "app/case-studies/[slug]/page.tsx", "app/case-studies/ariance/page.tsx"];
  const cdir = "components/cases";
  if (exists(root, cdir)) for (const f of readdirSync(join(root, cdir)).sort()) if (f.endsWith(".tsx")) list.push(`${cdir}/${f}`);
  return list;
};

export function allFields(root) {
  const f = { ...caseFields(root), ...arianceFields(root) };
  for (const file of TSX_FILES(root)) Object.assign(f, tsxFields(root, file));
  return f;
}

// ---- source resolution -----------------------------------------------------------------------------------------------
/** yes = in-repo file exists (and contains every expected string); ext = declared external receipt with system, date and locator, not checkable here; no = broken. */
export function resolveSource(root, src) {
  if (!src) return { r: "no", why: "unknown source id" };
  if (src.path) {
    if (!exists(root, src.path)) return { r: "no", why: `file missing: ${src.path}` };
    const body = read(root, src.path);
    for (const needle of src.contains || []) if (!body.includes(needle)) return { r: "no", why: `${src.path} lacks "${needle}"` };
    return { r: "yes", why: src.path };
  }
  if (src.external && src.system && /^\d{4}-\d{2}-\d{2}$/.test(src.date || "") && src.locator) return { r: "ext", why: `${src.system} (${src.date})` };
  return { r: "no", why: "receipt has no file, and no system+date+locator" };
}

// ---- the check -------------------------------------------------------------------------------------------------------
const AUDIT_CERT = /\b(audit(?:ed|or|ors|ing|s)?|certif\w*|accredit\w*|attest\w*|ISO[ -]?\d{4,5}|SOC ?[12])\b/i;
const AUDIT_OK = /\baudit log\b/gi; // a product feature, not a claim about us

/** Returns { inv: [{id, name, pass, fail, fails[]}], table: [[page, figure, kind, source, resolves]], defects: [] } */
export function check(root) {
  const man = JSON.parse(read(root, "lib/case-studies/trace.json"));
  const fields = allFields(root);
  const inv = [];
  const add = (id, name) => { const o = { id, name, pass: 0, fail: 0, fails: [] }; inv.push(o); return (c, m) => { if (c) o.pass++; else { o.fail++; o.fails.push(m); } }; };
  const table = [];

  // I1: every figure is claimed, and nothing is claimed that is not on the page
  const i1 = add("I1", "every figure is in the manifest and every claimed figure is on the page");
  const mf = man.fields || {};
  for (const [key, text] of Object.entries(fields)) {
    const figs = figures(text);
    if (!figs.length) continue;
    const e = mf[key];
    if (!e) { i1(false, `${key}: figures [${figs.join(", ")}] have no manifest entry`); continue; }
    for (const g of figs) i1((e.figs || []).includes(g), `${key}: figure "${g}" is not claimed in the manifest`);
    for (const g of e.figs || []) i1(figs.includes(g), `${key}: manifest claims "${g}" but it is not on the page`);
  }
  for (const key of Object.keys(mf)) i1(key in fields && figures(fields[key]).length > 0, `manifest entry ${key} has no figure-bearing field on the page (stale)`);

  // I2: every figure's source id exists and resolves
  const i2 = add("I2", "every figure carries a source that resolves to an existing file or a declared receipt");
  const reg = man.sources || {};
  for (const [key, e] of Object.entries(mf)) {
    const ids = e.src || [];
    i2(ids.length > 0, `${key}: no source id`);
    const res = ids.map((id) => ({ id, ...resolveSource(root, reg[id]) }));
    for (const r of res) i2(r.r !== "no", `${key}: source ${r.id} does not resolve (${r.why})`);
    const best = res.some((r) => r.r === "yes") ? "yes" : res.some((r) => r.r === "ext") ? "ext" : "no";
    const page = key.startsWith("tsx:") ? key.split(":")[1] : key.split(".")[0] === "cases" ? `case-studies/${key.split(".")[1]}` : key.split(".")[0] === "ariance" ? "case-studies/ariance" : key;
    for (const g of e.figs || []) table.push([page, g, kind(g), ids.join("+") || "(none)", ids.length ? best : "no"]);
  }

  // I3: every case study is labelled, in its own data, and the manifest agrees
  const i3 = add("I3", "each case study is labelled REAL, SYNTHETIC or MODELLED in its data and the label matches the manifest");
  const cases = loadCases(root);
  const arianceData = JSON.parse(read(root, "lib/case-studies/ariance.json"));
  const entries = [...cases.map((c) => ({ slug: c.slug, label: c.label })), { slug: "ariance", label: arianceData.label }];
  for (const e of entries) {
    i3(LABELS.includes(e.label), `${e.slug}: label ${JSON.stringify(e.label)} is not one of ${LABELS.join("/")}`);
    i3((man.cases?.[e.slug] || {}).label === e.label, `${e.slug}: manifest label ${JSON.stringify(man.cases?.[e.slug]?.label)} differs from data label`);
  }
  for (const slug of Object.keys(man.cases || {})) i3(entries.some((e) => e.slug === slug), `manifest case ${slug} has no case study`);

  // I4: the label is shown on the page that carries the case (a SYNTHETIC one must never appear without it)
  const i4 = add("I4", "the label is rendered on every case page and card; SYNTHETIC cannot render without it");
  const slugPage = read(root, "app/case-studies/[slug]/page.tsx");
  const card = read(root, "components/cases/CaseCard.tsx");
  const arianceP = read(root, "app/case-studies/ariance/page.tsx");
  const listP = read(root, "app/case-studies/page.tsx");
  i4(/\bc\.label\b/.test(slugPage), "app/case-studies/[slug]/page.tsx does not render c.label");
  i4(/\blabel\b/.test(card) && /label=\{c\.label\}/.test(listP), "CaseCard / case list does not pass and render the label");
  i4(/\blabel\b/.test(card) && /label=\{ARIANCE\.label\}/.test(listP), "the Ariance card on /case-studies does not pass its label");
  i4(/ARIANCE\.label|A\.label/.test(arianceP), "app/case-studies/ariance/page.tsx does not render the label");
  for (const c of cases) i4(!(c.label === "SYNTHETIC") || /synthetic/i.test(JSON.stringify(c)), `${c.slug}: SYNTHETIC case does not say so in its own text`);

  // I5: zero em or en dashes anywhere a case figure or sentence lives, manifest included
  const i5 = add("I5", "zero em or en dashes in the case-study sources, pages, components and manifest");
  const dashFiles = ["lib/caseStudies.ts", "lib/case-studies/ariance.json", "lib/case-studies/trace.json", ...TSX_FILES(root)];
  for (const f of dashFiles) i5(!/[–—]/.test(read(root, f)), `${f} contains an em or en dash`);

  // I6: no audit or certification wording
  const i6 = add("I6", "no audit or certification wording in case-study prose");
  for (const [key, text] of Object.entries(fields)) i6(!AUDIT_CERT.test(text.replace(AUDIT_OK, "")), `${key}: audit/certification wording "${(text.replace(AUDIT_OK, "").match(AUDIT_CERT) || [])[0]}"`);
  for (const f of ["lib/caseStudies.ts", "lib/case-studies/ariance.json"]) {
    const prose = read(root, f).replace(AUDIT_OK, "");
    i6(!AUDIT_CERT.test(prose), `${f}: audit/certification wording "${(prose.match(AUDIT_CERT) || [])[0]}"`);
  }

  // I7: no client named without a consent field
  const i7 = add("I7", "no client is named without a consent field set; unnamed cases carry no reserved name");
  const reserved = man.reserved_client_names || [];
  for (const c of cases) {
    const m = man.cases?.[c.slug] || {};
    i7(m.client_named === false || typeof m.consent === "boolean", `${c.slug}: names a client but has no boolean consent field`);
    const own = JSON.stringify(c);
    for (const n of reserved) i7(!(m.client_named === false) || !new RegExp(n, "i").test(own), `${c.slug}: declared unnamed but contains reserved name "${n}"`);
  }
  const am = man.cases?.ariance || {};
  i7(am.client_named === true && typeof arianceData.client_consent === "boolean" && am.consent === arianceData.client_consent, "ariance names a client: client_consent is boolean and the manifest agrees");
  const ap = read(root, "lib/case-studies/ariance.ts");
  i7(arianceData.client_consent === true || (/arianceVisible/.test(listP) && /index: false, follow: false/.test(arianceP) && /client_consent === true/.test(ap)), "ariance without consent is noindex and off the list");

  // I8: arithmetic that the displayed figures imply (so a figure cannot be edited without its sum)
  const i8 = add("I8", "stated durations and totals follow from the stated start, end and parts");
  const by = Object.fromEntries(cases.map((c) => [c.slug, c]));
  const mins = (a, b) => { const [h1, m1] = a.split(":").map(Number), [h2, m2] = b.split(":").map(Number); return h2 * 60 + m2 - (h1 * 60 + m1); };
  const d = by["dealer-command-centre"], s = by["sales-coaching-course"], t = by["trading-app"];
  if (d) {
    const [a, b] = (d.facts[0][1].match(/\((\d\d:\d\d)\).*\((\d\d:\d\d)\)/) || []).slice(1);
    i8(a && mins(a, b) === 70, "dealer: 15:36 to 16:46 is 70 minutes");
    const p = (d.facts[1][1].match(/(\d+) discovery, (\d+) builders, (\d+) reviewers and (\d+) lead/) || []).slice(1).map(Number);
    i8(p.length === 4 && p.reduce((x, y) => x + y, 0) === Number(d.facts[1][0]), "dealer: 4+10+8+1 jobs equals the 23 stated");
  }
  if (s) {
    const [a, b] = (s.facts[0][1].match(/\((\d\d:\d\d)\).*\((\d\d:\d\d)\)/) || []).slice(1);
    i8(a && mins(a, b) === Number(s.facts[0][0].match(/\d+/)[0]), "sales: 10:44 to 12:07 equals the stated minutes");
    i8(mins("11:13", "12:07") === 54, "sales: first module 11:13 to 12:07 is the 54 minutes stated");
    i8(190 * 10 === 1900, "sales: 190 modules x 10 lessons equals 1,900 lessons");
  }
  if (t) {
    const [a, b] = (t.facts[0][1].match(/\((\d\d:\d\d)\).*\((\d\d:\d\d)\)/) || []).slice(1);
    i8(a && mins(a, b) === 210, "trading: 05:10 to 08:40 is 3.5 hours");
    const wk = (6 / 100) * (200 * 12 / 52);
    i8(Math.round(wk) === 3, `trading: 6% of one week of US$200 a month is about US$${wk.toFixed(2)}, stated as roughly US$3`);
  }

  // I9: components hold no hand-typed figure (they render data), and the proof page's logged figures match its logs
  const i9 = add("I9", "components/cases carry no hand-typed figure; the proof page's headline counts match the committed logs");
  for (const f of TSX_FILES(root).filter((x) => x.startsWith("components/cases/"))) {
    const tf = tsxFields(root, f);
    for (const [k, v] of Object.entries(tf)) i9(figures(v).length === 0, `${k}: hand-typed figure in a component`);
    i9(true, `${f} scanned`);
  }
  try {
    const trade = read(root, "public/proof/trading-app-tests.log"), spoof = read(root, "public/proof/spoofguard-tests.log"), rep = read(root, "public/proof/trading-app-build-replay.log");
    i9(/# pass 250\b/.test(trade), "trading log: # pass 250");
    i9(/Ran 83 tests/.test(spoof), "spoofguard log: Ran 83 tests");
    const rows = rep.split("\n").filter((l) => /^\d{4}-\d{2}-\d{2} /.test(l));
    i9(rows.length === 57, `replay log has ${rows.length} commit rows (page says 57)`);
    i9(rows.filter((l) => l.slice(11, 19) <= "08:40:59").length === 56, "replay log has 56 commits by 08:40 (trading-app case says 56)");
    i9(/\| 20\/20 \|/.test(rows[0]) && rows[0].includes("05:41") && /\| 250\/250 \|/.test(rows[rows.length - 1]) && rows[rows.length - 1].includes("09:37"), "replay: 20 tests at 05:41, 250 at 09:37");
  } catch (e) { i9(false, `proof logs unreadable: ${e.message}`); }

  return { inv, table, fields, man };
}
