// C5 product/course policy constants. Single source for the grader and its tests.
// REFUND: the /trust page (plan ch.6 site map, line 1457) does not exist yet (census 2026-11-06). Until it does, this line is
// the canonical refund sentence, copied word for word from the existing product FAQ (lib/products/products.ts REFUND) and
// consistent with app/terms/page.tsx "Refunds". /trust must render it verbatim. No new refund promise is made here.
export const TRUST_REFUND_LINE = "Refund terms are in our terms page and are confirmed in writing before you pay.";
export const TRUST_REFUND_HREF = "/terms#refunds";

// Outcome wording: no guaranteed income, no fake urgency. Applied to every visible string of an entry.
export const INCOME_CLAIM = /\b(guarantee[sd]?|guaranteed|risk[- ]free|make money|earn \$?\d|earn more|passive income|get rich|six[- ]figure|6[- ]figure|double your (income|revenue|sales)|triple your|financial freedom|replace your (job|salary|income)|never lose)\b/i;
export const FAKE_URGENCY = /\b(hurry|act now|last chance|limited time|limited spots?|only \d+ (left|spots?|places?|copies)|ends (tonight|today|soon|midnight)|today only|countdown|selling fast|don'?t miss out|while stocks last|expires? (soon|today|tonight)|offer ends)\b/i;

// Same lists as bin/content_lint.py (send_pack.TELLS + PHRASES), ported so the grader runs with zero Python.
export const AI_TELLS = /\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|synerg\w*|empower\w*|unlock\w*|tapestry|testament|pivotal|crucial|foster\w*|vibrant|intricate|realm|embark\w*|game-changer|paramount|meticulous\w*|underscor\w*|bespoke|elevat\w*|harness\w*|furthermore|moreover|stands as a|passionate about|excited to)\b|it'?s important to note|in today'?s|dive into|in conclusion|not only\b[^.]{0,80}\bbut also|plays? a crucial role/i;
export const AI_PHRASES = /(it'?s not (just|only) [^.]{1,60}, it'?s|let'?s dive|it'?s worth noting|game[- ]changer|unlock(ing)? the power|navigat(e|ing) the (complex|ever)|at the end of the day|whether you'?re a|look no further|elevate your|embark on)/i;
export const DASHES = new RegExp("[\u2013\u2014]"); // en and em dash, written as escapes so this file stays dash-free
