// Offer Finder scoring. Pure TypeScript: no React, no network, no path aliases,
// so Node can import it directly in scripts/test_finder.mjs. Same answers in,
// same result out. Scores come from offer data only.
import type { Offer, OfferGroup } from "./types";

export type Who = "tradie" | "practice" | "partner" | "supplier" | "enterprise" | "sales" | "unsure";
export type Need = "work" | "protect" | "gov" | "partners" | "board" | "hours" | "explore";
export type Budget = "free" | "under100" | "100to499" | "500plus" | "enterprise";
export type Avail = "BUYABLE" | "OPENING" | "SOON";

export type Answers = { who: Who; need: Need; budget: Budget; text?: string };

export const WHO_OPTIONS: { id: Who; label: string }[] = [
  { id: "tradie", label: "Tradie or local service" },
  { id: "practice", label: "Professional or health practice" },
  { id: "partner", label: "IT provider, broker, agency, accountant or franchise" },
  { id: "supplier", label: "Supplier who bids for government work" },
  { id: "enterprise", label: "Enterprise, board or investor" },
  { id: "sales", label: "Sales or growth team" },
  { id: "unsure", label: "Not sure" },
];
export const NEED_OPTIONS: { id: Need; label: string }[] = [
  { id: "work", label: "More work and leads" },
  { id: "protect", label: "Protect the business from scams and privacy risk" },
  { id: "gov", label: "Win government contracts" },
  { id: "partners", label: "Grow my clients or partners" },
  { id: "board", label: "Due diligence or board reporting" },
  { id: "hours", label: "Save hours with AI" },
  { id: "explore", label: "Just exploring" },
];
export const BUDGET_OPTIONS: { id: Budget; label: string }[] = [
  { id: "free", label: "Free first (up to AU$100)" },
  { id: "under100", label: "Under AU$100" },
  { id: "100to499", label: "AU$100 to 499 a month" },
  { id: "500plus", label: "AU$500 or more" },
  { id: "enterprise", label: "Enterprise" },
];

const WHO_GROUPS: Record<Who, OfferGroup[]> = {
  tradie: ["tradies", "selfserve"],
  practice: ["specialist", "selfserve"],
  partner: ["multipliers"],
  supplier: ["government"],
  enterprise: ["enterprise"],
  sales: ["sales"],
  unsure: [],
};
const NEED_GROUPS: Record<Need, OfferGroup[]> = {
  work: ["tradies", "sales"],
  protect: ["selfserve", "specialist"],
  gov: ["government"],
  partners: ["multipliers"],
  board: ["enterprise"],
  hours: ["selfserve", "tradies"],
  explore: [],
};
const NEED_TERMS: Record<Need, string[]> = {
  work: ["lead", "leads", "customer", "customers", "work", "jobs", "quote", "pipeline", "prospect"],
  protect: ["scam", "spoof", "phishing", "dmarc", "email", "privacy", "security", "cyber", "fraud"],
  gov: ["tender", "tenders", "council", "government", "panel", "contract", "bid", "procurement"],
  partners: ["client", "clients", "partner", "partners", "reseller", "white-label", "channel", "referral"],
  board: ["board", "investor", "due", "diligence", "briefing", "governance", "risk"],
  hours: ["ai", "automation", "inbox", "admin", "chaser", "invoice", "hours", "writer"],
  explore: [],
};

// Offline synonym table: free-text word -> who / need. Words are matched as whole tokens.
const WHO_SYNONYMS: Record<string, Who> = {
  plumber: "tradie", sparky: "tradie", electrician: "tradie", builder: "tradie", cleaner: "tradie",
  carpenter: "tradie", painter: "tradie", landscaper: "tradie", tradie: "tradie", tradies: "tradie",
  concreter: "tradie", roofer: "tradie", handyman: "tradie", mechanic: "tradie", cafe: "tradie", restaurant: "tradie", shop: "tradie", retail: "tradie", salon: "tradie",
  dentist: "practice", clinic: "practice", physio: "practice", ndis: "practice", aged: "practice",
  gp: "practice", vet: "practice", lawyer: "practice", practice: "practice", health: "practice",
  charity: "practice", nfp: "practice", school: "practice", principal: "practice", solicitor: "practice",
  accountant: "partner", bookkeeper: "partner", msp: "partner", broker: "partner",
  agency: "partner", franchise: "partner", franchisor: "partner", reseller: "partner",
  tender: "supplier", tenders: "supplier", council: "supplier", government: "supplier",
  panel: "supplier", supplier: "supplier",
  investor: "enterprise", director: "enterprise", enterprise: "enterprise",
  sales: "sales", recruiter: "sales", agent: "sales", realtor: "sales", marketing: "sales", growth: "sales", sdr: "sales",
};
const NEED_SYNONYMS: Record<string, Need> = {
  scam: "protect", spoof: "protect", spoofing: "protect", phishing: "protect", dmarc: "protect",
  privacy: "protect", cyber: "protect", security: "protect", hacked: "protect",
  leads: "work", lead: "work", customers: "work", work: "work", jobs: "work", quotes: "work",
  tender: "gov", tenders: "gov", council: "gov", government: "gov", panel: "gov", bid: "gov",
  clients: "partners", partners: "partners", referrals: "partners", reseller: "partners",
  investor: "board", board: "board", diligence: "board", governance: "board",
  ai: "hours", automation: "hours", inbox: "hours", drowning: "hours", overwhelmed: "hours", admin: "hours", paperwork: "hours", invoices: "hours",
};

export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
}

function editDistance1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diff > 1) return false;
    if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; }
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
}

function lookup<T>(table: Record<string, T>, t: string): T | undefined {
  if (Object.prototype.hasOwnProperty.call(table, t)) return table[t];
  // Tiny typo tolerance: one letter off, only for words of 5+ letters.
  if (t.length >= 5) for (const k of Object.keys(table)) if (k.length >= 5 && editDistance1(t, k)) return table[k];
  return undefined;
}

/** Read a free-text answer and guess who/need/budget from the synonym table. Deterministic. */
export function inferFromText(text: string): { who?: Who; need?: Need; budget?: Budget } {
  const toks = tokenize(text);
  const out: { who?: Who; need?: Need; budget?: Budget } = {};
  for (const t of toks) {
    const w = lookup(WHO_SYNONYMS, t);
    if (!out.who && w) out.who = w;
    const n = lookup(NEED_SYNONYMS, t);
    if (!out.need && n) out.need = n;
  }
  const low = text.toLowerCase();
  if (/\bfree\b/.test(low)) out.budget = "free";
  else if (/\b(cheap|cheapest|budget|tight|affordable)\b/.test(low)) out.budget = "under100";
  else {
    const m = low.match(/(?:\$|aud|au\$)\s*(\d[\d,]*)|(\d[\d,]*)\s*(?:dollars|bucks|a month|\/mo|per month)|under\s+(\d[\d,]*)/);
    if (m) {
      const n = parseInt((m[1] || m[2] || m[3]).replace(/,/g, ""), 10);
      out.budget = n <= 100 ? "under100" : n < 500 ? "100to499" : n < 1500 ? "500plus" : "enterprise";
    }
  }
  return out;
}

/** True when the words told us at least one thing (who, need or budget). */
export function understood(text: string): boolean {
  const g = inferFromText(text);
  return !!(g.who || g.need || g.budget);
}

export type Ctx = { offers: Offer[]; availability: (o: Offer) => Avail };
export type Recommendation = {
  top: Offer[];
  also: Offer[];
  reason: Record<string, string>;
};

const RANK: Record<Avail, number> = { BUYABLE: 8, OPENING: 4, SOON: 0 };

function monthlyish(o: Offer): number | null {
  return o.priceAud === null || o.cadence === "quote" ? null : o.priceAud;
}

function budgetScore(o: Offer, b: Budget): number {
  const p = monthlyish(o);
  switch (b) {
    case "free": return p === 0 ? 6 : p !== null && p <= 100 ? 3 : -4;
    case "under100": return p !== null ? 2 : 0;
    case "100to499": return p !== null && p >= 100 && p < 500 ? 4 : p !== null && p < 100 ? 1 : -2;
    case "500plus": return p !== null && p >= 500 ? 4 : -1;
    case "enterprise": return o.group === "enterprise" || p === null || p >= 1500 ? 5 : -1;
  }
}

function hardExcluded(o: Offer, b: Budget): boolean {
  const p = monthlyish(o);
  if (b === "under100") return p === null || p > 100;
  if (b === "free") return p === null || p > 100;
  if (b === "100to499") return p !== null && p > 499;
  return false;
}

const STOP = new Set(["the","and","for","with","from","that","this","are","was","you","your","our","can","get","has","have","not","but","all","any","its","into","out","who","how","what","want","need","looking","more","some","just"]);

function hasWord(hay: string, w: string): boolean {
  const esc = w.replace(/[^a-z0-9]/g, "");
  if (!esc) return false;
  return new RegExp("(^|[^a-z0-9])" + esc + "([^a-z0-9]|$)").test(hay);
}

function textHits(o: Offer, terms: string[]): number {
  if (terms.length === 0) return 0;
  const name = o.name.toLowerCase();
  const who = (o.buyer + " " + o.forWho.join(" ")).toLowerCase();
  const rest = (o.bluf + " " + o.youGet.join(" ")).toLowerCase();
  let s = 0;
  for (const t of terms) {
    if (hasWord(name, t)) s += 3;
    if (hasWord(who, t)) s += 2;
    if (hasWord(rest, t)) s += 1;
  }
  return Math.min(s, 12);
}

const GROUP_PHRASE: Record<OfferGroup, string> = {
  tradies: "built for trades and local services",
  multipliers: "built for partners who serve many clients",
  government: "built for suppliers going after government work",
  enterprise: "built for boards, investors and large teams",
  sales: "built for sales and growth teams",
  selfserve: "a quick self-serve tool",
  specialist: "built for practices and specialist services",
};

export function recommend(answers: Answers, ctx: Ctx): Recommendation {
  const inferred = inferFromText(answers.text || "");
  const textTerms = tokenize(answers.text || "").filter((t) => (t.length >= 3 || t === "ai") && !STOP.has(t));
  // First group in each list is the primary fit (full weight); later ones count half.
  const whoG = new Map<OfferGroup, number>();
  const addWho = (w: Who) => WHO_GROUPS[w].forEach((g, i) => whoG.set(g, Math.max(whoG.get(g) ?? 0, i === 0 ? 6 : 3)));
  addWho(answers.who);
  const needG = new Set<OfferGroup>(NEED_GROUPS[answers.need]);
  // Free text can add groups on top of the chip answers (never removes them).
  if (inferred.who) addWho(inferred.who);
  if (inferred.need) NEED_GROUPS[inferred.need].forEach((g) => needG.add(g));
  const needTerms = NEED_TERMS[answers.need];
  const explore = answers.need === "explore" || answers.who === "unsure";

  type Scored = { o: Offer; score: number; av: Avail; why: string[] };
  const score = (pool: Offer[], strict: boolean): Scored[] =>
    pool
      .filter((o) => !(strict && hardExcluded(o, answers.budget)))
      .map((o) => {
        const av = ctx.availability(o);
        const why: string[] = [];
        let s = RANK[av];
        if (whoG.has(o.group)) { s += whoG.get(o.group)!; why.push(GROUP_PHRASE[o.group]); }
        if (needG.has(o.group)) { s += 5; if (!why.length) why.push(GROUP_PHRASE[o.group]); }
        const nh = textHits(o, needTerms);
        if (nh) { s += nh; }
        const th = textHits(o, textTerms);
        if (th) { s += th; why.push("matches what you wrote"); }
        const bs = budgetScore(o, answers.budget);
        s += bs;
        if (explore) {
          const p = monthlyish(o);
          if (p !== null && p <= 100) s += 2;
          if (p !== null && p <= 30) s += 2;
          if (av === "OPENING") s += 4;
        }
        if (bs > 0 && answers.budget !== "enterprise") why.push("fits your budget");
        if (bs > 0 && answers.budget === "enterprise") why.push("suits a larger engagement");
        return { o, score: s, av, why };
      })
      .sort((a, b) => b.score - a.score || RANK[b.av] - RANK[a.av] || (a.o.slug < b.o.slug ? -1 : 1));

  let ranked = score(ctx.offers, true);
  // Fallback: if the budget filter leaves fewer than 3, relax it and rank the rest after.
  if (ranked.length < 3) {
    const have = new Set(ranked.map((r) => r.o.slug));
    const rest = score(ctx.offers.filter((o) => !have.has(o.slug)), false).filter((r) => monthlyish(r.o) !== null);
    ranked = ranked.concat(rest);
  }
  // Guarantee one thing the visitor can act on today: if the top 3 are all launching soon,
  // bring in the best BUYABLE or OPENING offer from a group that matches who/need.
  if (!ranked.slice(0, 3).some((r) => r.av !== "SOON")) {
    const idx = ranked.findIndex((r, i) => i >= 3 && r.av !== "SOON" && (whoG.has(r.o.group) || needG.has(r.o.group)));
    if (idx !== -1) { const [pick] = ranked.splice(idx, 1); ranked.splice(2, 0, pick); }
  }
  const top = ranked.slice(0, 3);
  const also = ranked.slice(3, 8);
  const reason: Record<string, string> = {};
  for (const r of [...top, ...also]) {
    const bits = r.why.length ? r.why : ["a safe first step if you are not sure"];
    const avTxt = r.av === "BUYABLE" ? "You can buy it online today" : r.av === "OPENING" ? "The free first step is open now" : "It is launching soon, so you can register interest";
    reason[r.o.slug] = `${bits[0][0].toUpperCase()}${bits[0].slice(1)}${bits.length > 1 ? ", " + bits.slice(1).join(", ") : ""}. ${avTxt}.`;
  }
  return { top: top.map((r) => r.o), also: also.map((r) => r.o), reason };
}
