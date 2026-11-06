// Trust Centre gate: every claim row has a valid state and an evidence pointer that resolves;
// the page states OSG-1 OPEN, SYNTHETIC and not-an-audit; no held-status words anywhere in the text.
import fs from "node:fs";
const ROOT = new URL("../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, ROOT), "utf8");
const data = JSON.parse(read("lib/trust-centre.json"));
const page = read("app/trust/page.tsx");
const fails = [];
const STATES = ["BUILT_TESTED", "PLANNED", "OPEN"];
const BANNED = /\b(certified|certification held|audited|SOC ?2|ISO ?27001)\b/i;
const DASH = /[–—]/;

export function checkRows(rows) {
  const out = [];
  const ids = new Set();
  if (!Array.isArray(rows) || rows.length === 0) out.push("no claim rows");
  for (const r of rows || []) {
    const id = r && r.id ? r.id : "?";
    if (ids.has(id)) out.push(`${id}: duplicate id`);
    ids.add(id);
    if (!r.claim || typeof r.claim !== "string") out.push(`${id}: no claim text`);
    if (!STATES.includes(r.state)) out.push(`${id}: missing or invalid state`);
    const e = r.evidence;
    if (!e || !e.detail) { out.push(`${id}: no evidence pointer`); continue; }
    if (e.kind === "file") {
      if (!e.path || !e.anchor) { out.push(`${id}: file evidence lacks path or anchor`); continue; }
      let txt = null;
      try { txt = read(e.path); } catch { out.push(`${id}: evidence file missing ${e.path}`); continue; }
      if (!txt.includes(e.anchor)) out.push(`${id}: anchor not found in ${e.path}`);
    } else if (e.kind === "external") {
      if (!/@ [0-9a-f]{40}$/.test(e.ref || "")) out.push(`${id}: external ref needs branch @ 40-hex sha`);
    } else out.push(`${id}: unknown evidence kind`);
    if (r.state === "BUILT_TESTED" && !/test_/.test(e.detail)) out.push(`${id}: BUILT_TESTED names no test`);
  }
  return out;
}

fails.push(...checkRows(data.claims));

// self-test: the checker must reject bad rows
const bad = [
  [{ id: "a", claim: "x", evidence: { kind: "file", path: "lib/trust-centre.json", anchor: "OSG-1", detail: "d" } }, "missing or invalid state"],
  [{ id: "b", claim: "x", state: "OPEN" }, "no evidence pointer"],
  [{ id: "c", claim: "x", state: "OPEN", evidence: { kind: "file", path: "lib/trust-centre.json", anchor: "zzz-nope", detail: "d" } }, "anchor not found"],
];
for (const [row, want] of bad) if (!checkRows([row]).some((m) => m.includes(want))) fails.push(`self-test: checker did not reject (${want})`);
if (!BANNED.test("we are SOC 2 certified") || !BANNED.test("ISO 27001") || !BANNED.test("fully audited")) fails.push("self-test: banned pattern broken");

// page text = page source string content + data text
const text = page + "\n" + JSON.stringify(data);
if (BANNED.test(text)) fails.push(`banned held-status wording: ${text.match(BANNED)[0]}`);
if (DASH.test(text)) fails.push("em or en dash in page text");
if (!/OSG-1/.test(JSON.stringify(data.osg1)) || data.osg1.status !== "OPEN" || !/OPEN/.test(data.osg1.line)) fails.push("OSG-1 not stated OPEN");
if (!/OSG1_LINE/.test(page)) fails.push("page does not render the OSG-1 line");
if (!/SYNTHETIC/.test(page)) fails.push("page lacks SYNTHETIC label");
if (!/audit or a certification/.test(page)) fails.push("page lacks not-an-audit statement");
for (const s of STATES) if (!page.includes(s) && !/ORDER/.test(page)) fails.push(`page never shows state ${s}`);

fails.forEach((f) => console.log("FAIL " + f));
console.log(fails.length ? `FAIL ${fails.length}` : `ALL PASS (${data.claims.length} rows)`);
process.exit(fails.length ? 1 : 0);
