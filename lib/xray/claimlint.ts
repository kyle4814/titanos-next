// Claim lint for the Free Workflow X-Ray: a pure TypeScript port of the MF6 claim lint, so the browser engine
// refuses the same claim text the Python engine (bin/mf_xray.py -> bin/mf_claim_lint.py) refuses.
// Source of every rule (nothing invented): klinge-kernel branch origin/mf6-int, bin/mf_claim_lint.py
// (check_line, lint_markdown, lint_json, _EXTRA), bin/mf_pitch.py (FORBIDDEN_CLAIMS, FORBIDDEN_EQUITY,
// FORBIDDEN_MISC, _CONFUSABLES, fold, DOLLAR_RX, _norm_money) and bin/mf_interface.py (forbidden: HALO, retired ask).
// Limits (UNKNOWN, as in Python): number-words ("twenty-two thousand") and prices split across lines.
// Not ported on purpose: the QA-receipt exemption in lint_json (this engine never emits a QA receipt).
// Pure: no network, no clock, no storage.

export type Finding = { rule: string; detail: string; line?: number; path?: string };

const FORBIDDEN_CLAIMS: [string, string][] = [
  ["unique", String.raw`\bunique(?:ly)?\b`],
  ["world-first", String.raw`world[\s-]+first|first\s+in\s+the\s+world|world'?s\s+first|one[\s-]of[\s-]a[\s-]kind`],
  ["certified", String.raw`\bcertified\b|\baccredited\b|\battested\b`],
  ["compliant", String.raw`\bcompliant\b|complian(?:t|ce)\s+by\s+design|fully\s+compliant`],
  ["cert-standard", String.raw`\biso\s?/?\s?(?:iec\s?)?2700\d|\bsoc\s?[123]\b|essential\s+(?:8|eight)|\bpci[\s-]?dss\b|\bhipaa\b`],
  ["guaranteed", String.raw`\bguarantee[ds]?\b|\bguaranteeing\b|\bassured\b|\brisk[\s-]?free\b|\bzero[\s-]+risk\b|\bfoolproof\b|\bunhackable\b`],
  ["will-save", String.raw`\bwill\s+(?:definitely\s+)?(?:save|reduce|cut|eliminate|deliver|pay\s+for\s+itself)\b|\bsaves?\s+you\b`],
  ["existing-clients", String.raw`existing\s+(?:clients?|customers?|references?)|\bour\s+(?:clients?|customers?)\b|trusted\s+by|case\s+stud(?:y|ies)|testimonials?`],
  ["passive", String.raw`\bpassive(?:ly)?\b`],
  ["no-build-fee", String.raw`no[\s-]+build[\s-]+fee|zero[\s-]+build[\s-]+fee|free\s+build`],
  ["live-in-month-1", String.raw`live\s+in\s+(?:the\s+)?(?:first\s+)?month(?:\s+(?:1|one))?\b|live\s+within\s+(?:a|the\s+first)\s+month|live\s+in\s+30\s+days`],
  ["live-connectors", String.raw`live\s+connectors?`],
];
const FORBIDDEN_EQUITY: [string, string][] = [
  ["equity", String.raw`\bequity\b`],
  ["shares", String.raw`\bshares\b|\bshare\s?holders?\b|\bshareholding\b`],
  ["stake", String.raw`\bstakes?\b`],
  ["minority", String.raw`\bminority\b|\bcap\s?table\b|\bfunding\s+round\b|\bcapital\s+raise\b|\bdilut\w*|\bco[\s-]?invest\w*`],
  ["investor", String.raw`\binvest(?:or|ors|ment\s+partner)s?\b`],
  ["valuation", String.raw`\bvaluations?\b`],
  ["300k-ask", String.raw`\b300\s?k\b|\b300[\s,._']?000\b|\b300\s?(?:thousand|grand)\b|three[\s-]+hundred[\s-]+(?:thousand|k)\b`],
];
const DASHES: [string, string][] = [
  ["em-dash", "—"], ["en-dash", "–"], ["figure-dash", "‒"], ["horizontal-bar", "―"],
  ["two-em-dash", "⸺"], ["three-em-dash", "⸻"],
];
const HALO_RX = String.raw`\bimagine[\s_.-]?halo\b|\bh[\s_.-]?a[\s_.-]?l[\s_.-]?o\b`;

// Cyrillic / Greek / dotless lookalikes folded to ASCII before matching (mf_pitch._CONFUSABLES, then claim_lint _EXTRA).
const CONFUSABLES: Record<number, string> = {
  0x0430: "a", 0x0435: "e", 0x043e: "o", 0x0440: "p", 0x0441: "c", 0x0443: "y", 0x0445: "x",
  0x0456: "i", 0x0458: "j", 0x0455: "s", 0x04bb: "h", 0x043d: "h", 0x0501: "d", 0x04cf: "l",
  0x0410: "A", 0x0412: "B", 0x0415: "E", 0x041a: "K", 0x041c: "M", 0x041d: "H", 0x041e: "O",
  0x0420: "P", 0x0421: "C", 0x0422: "T", 0x0425: "X",
  0x03bf: "o", 0x03b1: "a", 0x03bd: "v", 0x03c1: "p", 0x03b9: "i", 0x03ba: "k",
  0x0391: "A", 0x0392: "B", 0x0395: "E", 0x0397: "H", 0x0399: "I", 0x039a: "K", 0x039c: "M",
  0x039d: "N", 0x039f: "O", 0x03a1: "P", 0x03a4: "T", 0x03a7: "X",
  0x0131: "i", 0x0251: "a", 0x0261: "g", 0x01c0: "l", 0x2113: "l", 0x00df: "ss",
};
const EXTRA: Record<number, string> = {
  0x043c: "m", 0x0442: "t", 0x043a: "k", 0x0432: "b", 0x0443: "y", 0x0445: "x", 0x0440: "p",
  0x043e: "o", 0x0430: "a", 0x0435: "e", 0x0441: "c", 0x0456: "i",
};
const FOLD_MAP: Record<number, string> = { ...CONFUSABLES, ...EXTRA };

const DOLLAR_RX = /(?:AU[D]?\s?)?\$\s?\d[\d,]*(?:\.\d+)?\s?[kKmM]?\b|\bAUD\s?\d[\d,]*(?:\.\d+)?\s?[kKmM]?\b|\b\d[\d,]*(?:\.\d+)?\s?(?:dollars?|AUD)\b/g;
const URL_RX = /https?:\/\/\S+/g;
const CODE_RX = /`[^`\n]*`/g;
// Doctrine 06 prices (P1 2,500; P2 22,900 + milestones 50/30/20; P3 15,000 + 5,000/month; change-order 180/h).
const DOCTRINE_PRICES = new Set(["2500", "22900", "11450", "6870", "4580", "15000", "5000", "180"]);
const VALUE_LABEL = /\b(?:ASSUMED|MODELLED|ESTIMATED?|MEASURED|UNKNOWN|VERIFIED|SOURCED)\b/;
const P4_RX = /\bp4\b|\bpath\s?4\b|bespoke\s+enterprise/i;
const HEADING_RX = /^\s{0,3}#{1,6}\s/;
const SYNTH_RX = /SYNTHETIC DEMO|\bFICTIONAL\b/;
const RETIRED = /(au\$|\$)\s?300\s?(k\b|,000)|minority[\s-]*(stake|equity|investment)|equity[\s-]*(stake|offer|ask|investment)|sell(ing)?\s+(a\s+)?(stake|equity)/i;

/** NFKC, drop invisible format / control characters, fold lookalikes to ASCII. */
export function fold(text: string): string {
  const t = text.normalize("NFKC");
  let out = "";
  for (const c of t) {
    if (/\p{Cf}/u.test(c)) continue;
    if (/\p{Cc}/u.test(c) && c !== "\n" && c !== "\t") continue;
    const cp = c.codePointAt(0) as number;
    out += FOLD_MAP[cp] ?? c;
  }
  return out;
}

function hiddenChars(raw: string): string[] {
  const s = new Set<string>();
  for (const c of raw) {
    const cat = /\p{Cf}/u.test(c) ? "Cf" : /\p{Cc}/u.test(c) ? "Cc" : "";
    if (cat === "Cf" || (cat === "Cc" && !"\n\t\r".includes(c)))
      s.add("U+" + (c.codePointAt(0) as number).toString(16).toUpperCase().padStart(4, "0"));
  }
  return [...s].sort();
}

function normMoney(s: string): string {
  let t = s.replace(/\s/g, "").replace(/[.,]+$/, "");
  t = t.replace(/^AUD?(?=\$|\d)/, "");
  return t.startsWith("$") ? t : "$" + t.replace(/(dollars?|AUD)$/i, "");
}
const moneyKey = (m: string) => normMoney(m).replace(/[^0-9.]/g, "").replace(/\.+$/, "");

function* matches(rx: string, t: string): Generator<string> {
  for (const m of t.matchAll(new RegExp(rx, "gi"))) yield m[0];
}

function forbiddenInterface(t: string): string[] {
  const out = new Set<string>();
  const low = t.toLowerCase();
  if (new RegExp(String.raw`\bhalo\b`).test(low.replace(/[^a-z0-9]+/g, " ")) || low.replace(/[^a-z0-9]/g, "").includes("imaginehalo"))
    out.add("names scrapped HALO / ImagineHalo");
  if (RETIRED.test(t)) out.add("carries the retired equity / minority-stake ask");
  return [...out].sort();
}

/** Findings [rule, detail] for one line. proposed / labelled / p4Ctx come from the surrounding block. */
export function checkLine(raw: string, proposed: boolean, labelled: boolean, p4Ctx: boolean, synthetic = false): [string, string][] {
  const out: [string, string][] = [];
  const hc = hiddenChars(raw);
  if (hc.length) out.push(["hidden-characters", hc.join(",")]);
  const t = fold(raw);
  for (const msg of forbiddenInterface(t)) out.push(["retired-or-halo", msg]);
  for (const [code, rx] of FORBIDDEN_CLAIMS) {
    if (code === "existing-clients" && synthetic) continue;
    for (const m of matches(rx, t)) out.push(["forbidden-claim", `${code}:'${m}'`]);
  }
  for (const [code, rx] of FORBIDDEN_EQUITY) for (const m of matches(rx, t)) out.push(["equity-language", `${code}:'${m}'`]);
  for (const [code, ch] of DASHES) if (raw.includes(ch) || t.includes(ch)) out.push(["dash", code]);
  for (const m of matches(HALO_RX, t)) out.push(["forbidden-name", `halo:'${m}'`]);
  const scan = t.replace(URL_RX, " ").replace(CODE_RX, " ");
  const p4Line = p4Ctx || P4_RX.test(t);
  for (const m of scan.matchAll(DOLLAR_RX)) {
    const fig = m[0].trim();
    if (p4Line) out.push(["p4-priced", fig]);
    else if (DOCTRINE_PRICES.has(moneyKey(fig))) {
      if (!proposed) out.push(["price-without-proposed", fig]);
    } else if (!labelled) out.push(["price-not-in-doctrine", fig]);
  }
  return out;
}

/** Block-aware lint of plain text / markdown. */
export function lintMarkdown(text: string): Finding[] {
  const lines = text.split("\n");
  const found: Finding[] = [];
  const docSynth = SYNTH_RX.test(fold(lines.slice(0, 3).join("\n")));
  let headingProposed = false;
  let p4Section = false;
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].trim()) { i++; continue; }
    let j = i;
    while (j < lines.length && lines[j].trim()) j++;
    const block = lines.slice(i, j);
    for (const ln of block) {
      if (HEADING_RX.test(ln)) {
        const ft = fold(ln);
        headingProposed = ft.includes("PROPOSED");
        p4Section = P4_RX.test(ft);
      }
    }
    const btxt = fold(block.join("\n"));
    const proposed = btxt.includes("PROPOSED") || headingProposed;
    const labelled = VALUE_LABEL.test(btxt);
    const synthetic = docSynth || SYNTH_RX.test(btxt);
    block.forEach((ln, k) => {
      for (const [rule, detail] of checkLine(ln, proposed, labelled, p4Section, synthetic)) found.push({ line: i + k + 1, rule, detail });
    });
    i = j;
  }
  return found;
}

/** Walk every string (keys and values); a PROPOSED sibling label anywhere up the chain covers a price. */
export function lintJson(doc: unknown): Finding[] {
  const found: Finding[] = [];
  const walk = (o: unknown, path: string, proposed: boolean): void => {
    if (typeof o === "string") {
      for (const s of o.split("\n")) {
        for (const [rule, detail] of checkLine(s, proposed || fold(o).includes("PROPOSED"), VALUE_LABEL.test(fold(o)), false))
          found.push({ path, rule, detail });
      }
    } else if (Array.isArray(o)) {
      const here = proposed || o.some((v) => typeof v === "string" && fold(v).includes("PROPOSED"));
      o.forEach((v, n) => walk(v, `${path}[${n}]`, here));
    } else if (o && typeof o === "object") {
      const rec = o as Record<string, unknown>;
      const here = proposed || Object.values(rec).some((v) => typeof v === "string" && fold(v).includes("PROPOSED"));
      for (const [k, v] of Object.entries(rec)) { walk(k, path + "{key}", here); walk(v, path + "." + k, here); }
    }
  };
  walk(doc, "$", false);
  return found;
}

/** Plain-language refusal that names the rule and what would flip it. */
export function refusalMessage(what: string, f: Finding): string {
  const rule = f.rule === "forbidden-claim" || f.rule === "equity-language" ? `${f.rule} / ${f.detail.split(":")[0]}` : f.rule;
  return `${what} was refused by claim rule "${rule}" (matched ${f.detail}). ` +
    "WOULD-FLIP: describe the task in plain words with no guarantee, certification or standard name (ISO, SOC, Essential Eight), " +
    "no promise of savings, no investor wording, no dash characters and no dollar figure. Capacity freed is not cash saved.";
}

/**
 * Early check of one user-supplied string (a workflow name or the business label) with the rules that do not depend
 * on the surrounding block (everything except the price rules, which the output lint judges in context, exactly as
 * Python does). Every such rule also fires in Python on the echoed JSON, so this never refuses what Python accepts.
 */
export function firstUserFinding(s: string): Finding | null {
  const lines = fold(s).length ? s.split("\n") : [s];
  for (let n = 0; n < lines.length; n++) {
    const hit = checkLine(lines[n], true, true, false, false)[0];
    if (hit) return { rule: hit[0], detail: hit[1], line: n + 1 };
  }
  return null;
}

/** Lint everything a report says: the JSON (all strings and keys) and every text line, as the Python engine does. */
export function lintReport(rep: unknown, lines: string[]): Finding[] {
  const text = lines.map((l) => l.replace(/^[#!| ]+/, "").trimEnd()).join("\n");
  return [...lintJson(rep), ...lintMarkdown("SYNTHETIC DEMO\n\n" + text)];
}
