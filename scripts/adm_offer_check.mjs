// f413: pure checker for the /adm-sprint copy. Returns a list of problems; empty = clean.
// Used by scripts/test_adm_offer.mjs, which also feeds it mutated copies to prove each rule bites.
export const BANNED = [
  // urgency and fear (CT8, CT11)
  /\b(urgent\w*|hurry|act now|last chance|limited time|don'?t miss|expires?|countdown|penalt\w+|fines?|breach\w*|risk\w*|exposed|threat\w*|fail\w*|violation\w*|non-?complian\w+|crisis|panic|scary|dangerous)\b/i,
  // audit and certification wording
  /\b(audit\w*|certif\w+|accredit\w*|attest\w*|guarantee\w*|assured compliance|fully compliant)\b/i,
  // unsourced superlatives and number-words
  /\b(thousands|hundreds|millions|dozens|countless|world-class|leading|best-in-class|number one|100%)\b/i,
  // AI tells (content_lint list)
  /\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|synerg\w*|ecosystem)\b/i,
  // tracking, capture, popup
  /\b(subscribe|newsletter|sign up|download now|popup|pop-up)\b/i,
];
// Numeric tokens that may appear: every one traces to the committed research (see ADM_SOURCES refs).
export const ALLOWED_NUMBERS = new Set([
  "141", "184", "11", "77%", "81", "265", "10", "2026", "1.7", "1.9", "2024", "12", "90", "12-item",
  "25,000", "100,000", "500,000", "350,000", "150,000", "50m", "1%", "70", "30", "70%", "30%", "70/30", "au$0", "au$25,000", "au$100,000", "au$500,000", "au$350,000", "au$150,000", "au$50m",
]);
const REQUIRED_CONCERNS = ["who", "found", "public", "touched", "replaced", "tactics", "cost"];

export function checkAdmOffer(m) {
  const p = [];
  const copy = m.copy || [];
  const text = copy.join("\n");
  if (/[–—]/.test(text)) p.push("em or en dash in copy");
  for (const rx of BANNED) { const hit = text.match(rx); if (hit) p.push(`banned word: ${hit[0]}`); }
  for (const tok of text.match(/(?:AU\$)?\b\d[\d,.]*(?:%|[mM]\b|\/\d+)?/g) || []) {
    const t = tok.toLowerCase().replace(/[.,]$/, "");
    if (!ALLOWED_NUMBERS.has(t) && !ALLOWED_NUMBERS.has(t.replace(/^au\$/, ""))) p.push(`unsourced number: ${tok}`);
  }
  const srcIds = new Set((m.sources || []).map((s) => s.id));
  if (!srcIds.size) p.push("no sources listed");
  for (const s of m.sources || []) if (!/@ [0-9a-f]{10}$/.test(s.ref || "") || !s.label) p.push(`source ${s.id} lacks a path @ commit ref`);
  if (!(m.facts || []).length) p.push("no sourced facts");
  for (const f of m.facts || []) if (!srcIds.has(f.source)) p.push(`fact "${f.big}" cites a missing source`);
  const ids = new Set((m.concerns || []).map((c) => c.id));
  for (const r of REQUIRED_CONCERNS) if (!ids.has(r)) p.push(`concerns block missing: ${r}`);
  for (const c of m.concerns || []) if (!c.a || c.a.length < 40) p.push(`concern ${c.id} has no real answer`);
  const opts = m.options || [];
  const A = opts.find((o) => o.id === "A"), B = opts.find((o) => o.id === "B");
  if (!A || !/25,000/.test(A.lines.join(" "))) p.push("Option A fixed AU$25,000 missing");
  if (!B || !/70%/.test(B.lines.join(" ")) || !/30%/.test(B.lines.join(" ")) || !/AU\$0 up front/.test(B.lines.join(" "))) p.push("Option B 70/30 AU$0 up front missing");
  if (!/MODELLED/.test(text)) p.push("worked example not labelled MODELLED");
  if (!/would it be okay/i.test(m.close || "")) p.push("permission close missing");
  const src = (m.componentSrc || "").replace(/\/\/[^\n]*/g, "").replace(/\{\/\*[^]*?\*\/\}/g, "");
  if (/<form\b|<input\b|<button\b|onSubmit|fetch\(|useState|"use client"|localStorage|document\.cookie|gtag|analytics|dialog|role="dialog"|popup|modal/i.test(src)) p.push("component has a form, input, state, tracking or popup");
  return p;
}
