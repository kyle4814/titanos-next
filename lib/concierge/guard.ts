// F-C6 input guard. Pure, no clock, no random, no network. Junk and injection-shaped asks are never routed to an offer.
// The reject list is deliberately about SHAPE (markup, SQL, prompt-injection phrasing), not about topics.
export const REJECT: { name: string; rx: RegExp }[] = [
  { name: "html-tag", rx: /<\s*\/?\s*[a-z!][^>]{0,200}>/i },
  { name: "script-scheme", rx: /\b(?:javascript|vbscript|data)\s*:/i },
  { name: "sql-tautology", rx: /['"`]\s*(?:or|and)\s+['"`]?\w*['"`]?\s*=\s*['"`]?\w*/i },
  { name: "sql-keyword-chain", rx: /\b(?:union\s+(?:all\s+)?select|select\s+.{1,60}\s+from|drop\s+(?:table|database)|insert\s+into|delete\s+from|update\s+\w+\s+set|exec(?:ute)?\s*\(|xp_cmdshell)\b/i },
  { name: "sql-comment-tail", rx: /(?:;|'|")\s*--(?:\s|$)|\/\*[\s\S]*\*\//i },
  { name: "template-or-shell", rx: /\$\{[^}]*\}|\{\{[^}]*\}\}|`[^`]*`|\$\([^)]*\)|(?:^|\s)(?:rm\s+-rf|curl\s+http|wget\s+http|bash\s+-c|sudo\s)/i },
  { name: "path-traversal", rx: /(?:\.\.[\/\\]){1,}|\/etc\/passwd|c:\\windows/i },
  { name: "ignore-instructions", rx: /\b(?:ignore|disregard|forget|override|bypass)\b.{0,30}\b(?:all|any|the|your|previous|prior|above|earlier|system)\b.{0,30}\b(?:instructions?|prompts?|rules?|guidelines?|directions?)\b/i },
  { name: "role-hijack", rx: /(?:^|[\s.!?])(?:system|assistant|developer)\s*:|\byou\s+are\s+now\b|\bact\s+as\s+(?:a|an|if)\b|\bpretend\s+(?:to\s+be|you)\b|\bnew\s+instructions?\b|\bjailbreak\b|\bdeveloper\s+mode\b|\bDAN\s+mode\b/i },
  { name: "prompt-exfil", rx: /\b(?:reveal|show|print|repeat|leak|tell\s+me)\b.{0,30}\b(?:system\s+prompt|your\s+(?:instructions|prompt|rules)|hidden\s+prompt)\b/i },
];
const MIN_LETTER_SHARE = 0.55;   // of non-space characters: below this the ask is symbols and digits, not language
const MAX_REPEAT = 12;           // one character repeated this many times in a row is noise

export type Junk = { junk: false } | { junk: true; reason: string };

export function junkCheck(raw: string): Junk {
  const s = String(raw ?? "");
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s)) return { junk: true, reason: "control-chars" };
  for (const r of REJECT) if (r.rx.test(s)) return { junk: true, reason: r.name };
  const nonSpace = s.replace(/\s/g, "");
  if (nonSpace.length >= 4) {
    const letters = (nonSpace.match(/\p{L}/gu) ?? []).length;
    if (letters / nonSpace.length < MIN_LETTER_SHARE) return { junk: true, reason: "symbol-noise" };
  }
  if (new RegExp("([\\s\\S])\\1{" + MAX_REPEAT + ",}").test(s)) return { junk: true, reason: "repeat-noise" };
  return { junk: false };
}
