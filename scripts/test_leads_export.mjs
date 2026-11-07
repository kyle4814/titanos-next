// Leads export engine: golden, property, fuzz and mutation tests. All lead rows are SYNTHETIC fixtures.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SRC = new URL("../lib/leads-export.ts", import.meta.url);
const T0 = 1_800_000_000_000;

async function suite(mod, label) {
  let fail = 0;
  const ok = (c, m) => { if (!c) { fail++; if (label === "real") console.log(`FAIL ${m}`); } else if (label === "real") console.log(`PASS ${m}`); };
  const { exportLeads, DRAFT_RULES } = mod;
  const now = () => T0;

  // GOLDEN 1: AU, hand-computed. SYNTHETIC rows.
  const rows = [
    { id: "b2", name: "Bea, Test", organisation: 'Co "Two"', channel: "email", entityType: "business", consent: "inferred", email: "bea@example.test" },
    { id: "a1", name: "Ann Test", organisation: "One Pty Ltd", channel: "email", entityType: "individual", consent: "express", email: "ann@example.test" },
    { id: "c3", name: "=HYPERLINK(1)", organisation: "Three", channel: "email", entityType: "business", consent: "express", email: "c@example.test" },
    { id: "d4", name: "Dee", channel: "email", entityType: "individual", consent: "none", email: "dee@example.test" },
    { id: "e5", name: "Eve", channel: "phone", entityType: "individual", consent: "express", phone: "0400000000", dncClear: false },
    { id: "f6", name: "Fay", channel: "sms", entityType: "individual", consent: "express", phone: "0400000001" },
    { id: "g7", name: "Gus", channel: "email", entityType: "individual", consent: "express", email: "g@example.test", optedOut: true },
    { id: "h8", name: "Hal", channel: "email", entityType: "individual", email: "h@example.test" },
    { id: "i9", name: "Ivy", channel: "phone", entityType: "business", consent: "b2b_public", phone: "0400000002", dncClear: true },
  ];
  const r = exportLeads(rows, " au ", { now });
  const want = [
    "id,name,organisation,channel,entity_type,consent,email,phone,address",
    "a1,Ann Test,One Pty Ltd,email,individual,express,ann@example.test,,",
    'b2,"Bea, Test","Co ""Two""",email,business,inferred,bea@example.test,,',
    "c3,'=HYPERLINK(1),Three,email,business,express,c@example.test,,",
    "f6,Fay,,sms,individual,express,,0400000001,",
    "i9,Ivy,,phone,business,b2b_public,,0400000002,",
  ].join("\r\n") + "\r\n";
  ok(r.csv === want, "golden AU csv matches hand-computed text");
  ok(JSON.stringify(r.refusals.map((x) => [x.id, x.reason])) === JSON.stringify([["d4", "NO_CONSENT"], ["e5", "DNC_LISTED"], ["g7", "OPTED_OUT"], ["h8", "UNKNOWN"]]), "golden AU refusal list, reasons and order");
  ok(r.emitted === 5 && r.withheld === 4, "golden AU counts 5 emitted, 4 withheld");
  ok(r.method.includes("asOf=2027-01-15T08:00:00.000Z") && r.method.includes("rows=9 emitted=5 withheld=4") && r.method.includes("DRAFT for legal review"), "method line carries injected clock, counts, draft label");

  // GOLDEN 2: same rows, other countries (hand-computed accept sets).
  const ids = (c) => exportLeads(rows, c, { now }).csv.split("\r\n").slice(1, -1).map((l) => l.split(",")[0].replace(/^"/, ""));
  ok(JSON.stringify(ids("UK")) === JSON.stringify(["a1", "b2", "c3", "f6", "i9"]), "UK golden accept set");
  ok(JSON.stringify(ids("EU")) === JSON.stringify(["a1", "b2", "c3", "f6"]), "EU golden accept set (b2b_public phone not allowed)");
  ok(JSON.stringify(ids("US")) === JSON.stringify(["a1", "b2", "c3", "i9"]), "US golden accept set (sms needs a DNC reading, f6 has none)");
  ok(JSON.stringify(ids("NZ")) === JSON.stringify(["a1", "b2", "c3", "f6", "i9"]), "NZ golden accept set");

  // Unknown or hostile country fails closed.
  for (const c of ["", "XX", "__proto__", "constructor", "toString", undefined, null, 42]) {
    const x = exportLeads(rows, c, { now });
    ok(x.emitted === 0 && x.withheld === rows.length && x.refusals.every((q) => q.reason === "UNKNOWN") && x.csv.split("\r\n").length === 2, `country ${String(c)} fails closed`);
  }
  // Missing consent and missing channel contact fail closed.
  const bad = exportLeads([{ id: "z", channel: "email", entityType: "individual", email: "z@example.test" }, { id: "y", channel: "email", entityType: "individual", consent: "express", email: "  " }, null, 7, "s"], "AU", { now });
  ok(bad.emitted === 0 && bad.refusals.length === 5 && bad.refusals.every((q) => q.reason === "UNKNOWN"), "missing consent, blank contact, junk rows all UNKNOWN");
  ok(exportLeads([], "AU", { now }).csv === "id,name,organisation,channel,entity_type,consent,email,phone,address\r\n", "empty input gives header only");

  // PROPERTY + FUZZ: 1000 seeded rows.
  let seed = 12345;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const evil = ["=1+1", "+61400000000", "-5", "@SUM(A1)", "\t=x", "\r=x", " =x", 'a,"b"\nc', "plain", "", undefined, 5, null, "=cmd|' /C calc'!A0"];
  const fuzz = Array.from({ length: 1000 }, (_, i) => ({
    id: pick(["", `r${i}`, `r${i % 50}`, evil[Math.floor(rnd() * evil.length)]]),
    name: pick(evil), organisation: pick(evil), email: pick(evil), phone: pick(evil), address: pick(evil),
    channel: pick(["email", "phone", "sms", "post", "fax", undefined]),
    entityType: pick(["individual", "business", "x", undefined]),
    consent: pick(["express", "inferred", "b2b_public", "none", "optout", "maybe", undefined]),
    dncClear: pick([true, false, undefined, "yes"]), optedOut: pick([true, false, undefined]),
  }));
  fuzz.push(null, 3, "str", [], { id: Symbol.iterator.toString() });
  for (const country of ["AU", "NZ", "UK", "EU", "US", "ZZ"]) {
    let res, threw = false;
    try { res = exportLeads(fuzz, country, { now }); } catch { threw = true; }
    ok(!threw, `${country}: fuzz 1000 rows does not throw`);
    if (threw) continue;
    ok(res.emitted + res.withheld === fuzz.length && res.refusals.length === res.withheld, `${country}: emitted + withheld = input`);
    const refused = new Set(res.refusals.map((q) => q.index));
    ok(res.refusals.length === refused.size, `${country}: each row refused at most once`);
    // Re-derive the allowed set independently from the table and compare.
    const T = DRAFT_RULES[country];
    const allowedIdx = new Set();
    fuzz.forEach((x, i) => {
      if (!T || !x || typeof x !== "object") return;
      const c = T[x.channel]; if (!c) return;
      const contact = x.channel === "email" ? x.email : x.channel === "post" ? x.address : x.phone;
      if (typeof contact !== "string" || !contact.trim()) return;
      if (!["individual", "business"].includes(x.entityType)) return;
      if (!["express", "inferred", "b2b_public", "none", "optout"].includes(x.consent)) return;
      if (x.optedOut === true || x.consent === "optout") return;
      if (!(x.entityType === "individual" ? c.individual : c.business).includes(x.consent)) return;
      if (c.needsDncClear && x.dncClear !== true) return;
      allowedIdx.add(i);
    });
    ok(res.emitted === allowedIdx.size && [...allowedIdx].every((i) => !refused.has(i)) && [...refused].every((i) => !allowedIdx.has(i)), `${country}: every emitted row passes the independent gate, no denied row emitted`);
    // CSV parse back: no cell starts with a formula character.
    const cells = parseCsv(res.csv);
    ok(cells.length === res.emitted + 1, `${country}: csv record count = emitted + header`);
    ok(cells.every((rec) => rec.length === 9), `${country}: every record has 9 fields`);
    ok(cells.every((rec) => rec.every((c) => !/^[\t\r ]*[=+\-@]/.test(c) && !/^[\t\r]/.test(c) || c.startsWith("'"))), `${country}: no formula-injection cell survives`);
    const again = exportLeads(fuzz, country, { now });
    ok(again.csv === res.csv && JSON.stringify(again.refusals) === JSON.stringify(res.refusals), `${country}: deterministic`);
    const shuffled = exportLeads(fuzz.map((x) => x).reverse(), country, { now });
    ok(shuffled.emitted === res.emitted, `${country}: input order does not change the emitted count`);
  }
  // Clock hostility.
  ok(exportLeads(rows, "AU", { now: () => NaN }).method.includes("asOf=1970-01-01"), "NaN clock does not throw");
  return fail;
}

// Minimal RFC 4180 reader for round-trip checks. Skips the header.
function parseCsv(text) {
  const recs = []; let rec = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { rec.push(cell); cell = ""; }
    else if (ch === "\r" && text[i + 1] === "\n") { rec.push(cell); recs.push(rec); rec = []; cell = ""; i++; }
    else cell += ch;
  }
  return recs;
}

let fail = 0;
const real = await import(SRC.href);
fail += await suite(real, "real");

// Source hygiene: no send path, no clock, no randomness, no imports.
const src = readFileSync(SRC, "utf8");
const bad = [/\bimport\b/, /\bfetch\s*\(/, /XMLHttpRequest|WebSocket|nodemailer|smtp|sendMail|sendBeacon/i, /Date\.now|new Date\(\)|Math\.random|performance\.now/, /\bprocess\b|\brequire\b|child_process/];
for (const rx of bad) { const hit = rx.test(src.replace(/^\/\/.*$/gm, "")); if (hit) { fail++; console.log(`FAIL source contains ${rx}`); } else console.log(`PASS source free of ${rx}`); }
if (/[–—]/.test(src)) { fail++; console.log("FAIL dash in module"); } else console.log("PASS zero em or en dashes in module");

// Mutations: each must make the suite fail.
const dir = mkdtempSync(join(tmpdir(), "leadsexp-"));
const mutants = [
  ["skip the gate", "if (v.ok) keep.push", "if (true) keep.push"],
  ["drop the injection guard", "if (FORMULA_RX.test(s)) return \"'\" + s;", "if (false) return \"'\" + s;"],
];
for (const [name, from, to] of mutants) {
  if (!src.includes(from)) { fail++; console.log(`FAIL mutation anchor missing: ${name}`); continue; }
  const file = join(dir, `mut_${name.replace(/\W+/g, "_")}.ts`);
  writeFileSync(file, src.replace(from, to));
  let mf;
  try { mf = await suite(await import(pathToFileURL(file).href), "mutant"); } catch { mf = 1; }
  if (mf > 0) console.log(`PASS mutation "${name}" kills the suite (${mf} failing checks)`);
  else { fail++; console.log(`FAIL mutation "${name}" survived`); }
}

console.log(fail ? `leads-export: ${fail} FAILED` : "leads-export: all green");
process.exit(fail ? 1 : 0);
