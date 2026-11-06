// F60 ask-raising guard. Pure, code-only: no model call, no network, no clock, no random.
// Two jobs the router could not do: (1) declared sibling offers are never answered with a confident single pick unless the asker
// named the one variant; (2) a "lost / nothing here fits" ask is handed to a person and the FAQ instead of being forced onto a shelf.
import { tokens } from "./text.ts";

// A family is a set of near-duplicate offers. Markers are the words (or phrases) that name ONE member. Written from the catalogue
// (ids, titles, aliases), never from the holdout. A match is confident only if the ask names the top member's marker and no other member's.
export type FamilyMember = { id: string; markers: string[] };
export const FAMILIES: FamilyMember[][] = [
  [ // subbie finder: full, lite, channel, job flow
    { id: "offer:subbie-finder", markers: ["full version", "full one", "standard version", "head contractor finder"] },
    { id: "offer:subbie-finder-lite", markers: ["lite", "small", "cheaper", "light", "basic version"] },
    { id: "offer:subbie-finder-channel", markers: ["channel", "chamber", "chambers", "trade body", "trade bodies", "association"] },
    { id: "offer:job-flow", markers: ["job flow", "jobflow"] },
  ],
  [ // profit mirror: charity vs care and NDIS
    { id: "offer:charity-profit-mirror", markers: ["charity"] },
    { id: "offer:profit-mirror-care", markers: ["ndis", "care provider", "care providers", "aged care", "disability"] },
  ],
  [ // privacy automated decision making, and the wider packs
    { id: "offer:privacy-adm-fix", markers: ["rewrite", "redraft", "fix it for", "fix the wording"] },
    { id: "offer:privacy-adm-wording-check", markers: ["wording check", "check the wording", "check it", "review the wording"] },
    { id: "offer:privacy-essential-eight-pack", markers: ["essential eight", "e8", "pack"] },
    { id: "offer:five-jurisdiction-privacy-bundle", markers: ["jurisdiction", "jurisdictions", "gdpr", "five countries", "overseas privacy"] },
  ],
  [ // msp feeds
    { id: "offer:monitor-wholesale", markers: ["wholesale", "resell", "reseller", "resale"] },
    { id: "offer:msp-prospect-feed", markers: ["prospect", "prospects"] },
    { id: "offer:msp-panel-white-label-feed", markers: ["public sector", "panel"] },
  ],
  [ // following rivals on tenders
    { id: "offer:rival-watch", markers: ["rival", "rivals", "rival watch", "changing", "changes"] },
    { id: "offer:tender-intelligence-radar", markers: ["tender intelligence", "radar", "win map", "win maps", "winning tenders", "win contracts", "wins contracts", "who wins"] },
  ],
  [ // an incumbent on one contract
    { id: "offer:incumbent-brief", markers: ["incumbent"] },
    { id: "offer:rebid-tender-brief", markers: ["rebid", "displacement", "displace"] },
  ],
];
export const FAMILY_OF = new Map<string, FamilyMember[]>();
for (const f of FAMILIES) for (const m of f) FAMILY_OF.set(m.id, f);

const MARK = (m: FamilyMember) => m.markers.map((k) => tokens(k)).filter((t) => t.length);
function hasRun(q: string[], k: string[]): boolean {
  outer: for (let i = 0; i + k.length <= q.length; i++) { for (let j = 0; j < k.length; j++) if (q[i + j] !== k[j]) continue outer; return true; }
  return false;
}
const named = (q: string[], m: FamilyMember) => MARK(m).some((k) => hasRun(q, k));

// Returns the family to ask about, or null when the ask named exactly the top member (or the top is not in a family).
export function familyToAsk(q: string[], topId: string): FamilyMember[] | null {
  const fam = FAMILY_OF.get(topId);
  if (!fam) return null;
  const top = fam.find((m) => m.id === topId)!;
  const others = fam.filter((m) => m.id !== topId);
  if (named(q, top) && !others.some((m) => named(q, m))) return null;
  return fam;
}

// "Lost" asks: the asker says nothing fits or they cannot find it, and names no subject. Content words left after the lost-phrase
// and filler are removed must be zero, so "I cannot find my invoices" still routes to Invoices.
const LOST_RX: RegExp[] = [
  /\b(?:can ?not|cant|couldnt|could not|unable to|not able to|dont know how to|can ?not work out)\s+(?:find|see|work out|locate|tell)\b/,
  /\bnone of (?:this|these|it|that)\b/,
  /\bnothing (?:here|on this (?:page|site)|on the site)?\s*(?:matches|fits|covers|helps|works)\b/,
  /\bi am (?:lost|confused|stuck)\b|\bim (?:lost|confused|stuck)\b|\bwhere do i (?:even )?(?:start|begin)\b/,
  /\bnot what i (?:wanted|need|needed|am after|was after|meant)\b|\bthis is not what i (?:wanted|need)\b/,
  /\b(?:no answer|not answered|not covered)\b/,
  /\blooked everywhere\b/,
];
const FILLER = new Set(["around", "anything", "everywhere", "anywhere", "page", "site", "website", "here", "there", "looking", "look", "clicking", "click", "answer", "question", "covered", "wanted", "all", "even", "start", "begin", "lost", "confused", "stuck", "match", "fit", "cover", "help", "work", "find", "see", "locate", "tell", "none", "nothing", "no", "not", "been", "have", "everything", "thing", "things", "somewhere", "really", "properly", "yet", "still", "far", "got", "get", "going", "wrong", "else", "other", "meant", "after", "trying", "try", "do", "make", "sense", "cant", "cannot", "couldnt", "unable", "able", "dont", "know", "now", "again", "ive", "im", "what", "which", "where", "own", "way", "out", "up", "down", "back", "over", "through", "scroll", "scrolled", "tried"]);
export function lostIntent(raw: string): boolean {
  const s = String(raw ?? "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!LOST_RX.some((r) => r.test(s))) return false;
  const rest = s.split(" ").filter((w) => w && !FILLER.has(w)).map((w) => tokens(w)[0]).filter((w) => w && !FILLER.has(w));
  return rest.length === 0;
}
