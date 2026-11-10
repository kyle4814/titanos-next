// rm_css.mjs - tiny CSS parser for the reduced-motion / print gate (f403_c1). No dependencies.
// parseCss(text) -> { rules: [{at:[prelude...], sels, decls:[{prop,value}]}], keyframes: [{name, body, at}] }
// Handles comments, nested at-rules, CSS nesting (& resolved), @keyframes bodies kept raw.

export function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, " ");
}

// Split a body into top-level pieces: declarations (ended by ;) and blocks (prelude { ... }).
function pieces(text) {
  const out = [];
  let i = 0, start = 0, depth = 0, quote = null, paren = 0, openAt = -1;
  let prelude = "";
  while (i < text.length) {
    const c = text[i];
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; }
    else if (c === '"' || c === "'") quote = c;
    else if (c === "(") paren++;
    else if (c === ")") paren = Math.max(0, paren - 1);
    else if (depth === 0 && paren === 0 && c === ";") { out.push({ decl: text.slice(start, i) }); start = i + 1; }
    else if (c === "{" && paren === 0) {
      if (depth === 0) { prelude = text.slice(start, i); openAt = i; }
      depth++;
    } else if (c === "}" && paren === 0) {
      depth--;
      if (depth === 0) { out.push({ prelude: prelude.trim(), body: text.slice(openAt + 1, i) }); start = i + 1; }
      if (depth < 0) depth = 0;
    }
    i++;
  }
  const tail = text.slice(start).trim();
  if (tail && depth === 0) out.push({ decl: tail });
  return out;
}

const splitSel = (s) => s.split(/,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean);

function declOf(d) {
  const m = d.match(/^\s*([-\w]+)\s*:\s*([\s\S]+?)\s*$/);
  return m ? { prop: m[1].toLowerCase(), value: m[2].replace(/\s*!important\s*$/i, "").trim(), important: /!important/i.test(m[2]) } : null;
}

export function parseCss(raw) {
  const text = stripComments(raw);
  const rules = [], keyframes = [];
  (function walk(body, at, parentSels) {
    const decls = [];
    for (const p of pieces(body)) {
      if (p.decl !== undefined) { const d = declOf(p.decl); if (d) decls.push(d); continue; }
      const pre = p.prelude;
      if (/^@(-\w+-)?keyframes/i.test(pre)) { keyframes.push({ name: pre.replace(/^@\S+\s+/, "").trim(), body: p.body, at: [...at] }); continue; }
      if (pre.startsWith("@")) {
        if (/^@(font-face|property|page)/i.test(pre)) continue;
        walk(p.body, [...at, pre.replace(/\s+/g, " ")], parentSels);
        continue;
      }
      let sels = splitSel(pre);
      if (parentSels.length) sels = sels.flatMap((s) => parentSels.map((ps) => (s.includes("&") ? s.replace(/&/g, ps) : `${ps} ${s}`)));
      walk(p.body, at, sels);
    }
    if (decls.length && parentSels.length) rules.push({ at, sels: parentSels, decls });
  })(text, [], []);
  return { rules, keyframes };
}

export const isReduce = (at) => at.some((a) => /prefers-reduced-motion\s*:\s*reduce/i.test(a));
export const isNoPref = (at) => at.some((a) => /prefers-reduced-motion\s*:\s*no-preference/i.test(a));
export const isPrint = (at) => at.some((a) => /^@media[^{]*\bprint\b/i.test(a));

// seconds from a time token list
export function times(v) {
  return [...v.matchAll(/(-?[\d.]+)(ms|s)\b/g)].map((m) => (m[2] === "ms" ? +m[1] / 1000 : +m[1]));
}
