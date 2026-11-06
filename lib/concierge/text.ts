// Deterministic text normalisation. Same input, same tokens, always.
const STOP = new Set("a an the i me my we our you your is are am was be to of for on in at it its do does did can could would should will shall please just and or but with this that these those there here have has had how what when where which who whom why if so as by from about into than then need want like get got let us one some any thing".split(" "));
const SYN: Record<string, string> = {
  site: "website", web: "website", webpage: "website", url: "website", sites: "website",
  mail: "email", emails: "email", inbox: "email", gmail: "email", mailbox: "email",
  hack: "attack", hacker: "attack", hacked: "attack", breach: "attack",
  cheap: "price", cost: "price", pricing: "price", charge: "price", fee: "price", expensive: "price",
  buy: "purchase", purchase: "purchase", order: "purchase",
  bot: "robot", robotic: "robot",
  tradie: "trade", tradies: "trade", tradesman: "trade", plumber: "trade", sparky: "trade", electrician: "trade", builder: "trade", builders: "trade",
  mssp: "msp", built: "build", builds: "build",
  pv: "solar",
  repair: "fix", resolve: "fix", solve: "fix", correct: "fix", remedy: "fix",
  reach: "contact", ring: "contact", speak: "contact", talk: "contact",
  eye: "monitor", watch: "monitor", track: "monitor", surveillance: "monitor",
  invest: "investor", investing: "investor", investment: "investor", funding: "investor", stake: "investor", shareholder: "investor",
  earn: "commission", earning: "commission", referring: "referral", refer: "referral",
  legally: "legal", lawful: "legal", allowed: "legal", permitted: "legal", illegal: "legal",
  details: "data", information: "data", info: "data",
  working: "status", operational: "status", outage: "status", down: "status", offline: "status",
  subcontractor: "subbie", subcontractors: "subbie", subcontract: "subbie", contractor: "subbie", contractors: "subbie",
  receipt: "invoice", receipts: "invoice", bill: "invoice", bills: "invoice", close: "cancel", terminate: "cancel", end: "cancel", credentials: "key", credential: "key", climb: "rank", leaderboard: "rank",
  faults: "problem", fault: "problem", issue: "problem", issues: "problem", flaw: "problem", detected: "find", found: "find",
  late: "overdue", unpaid: "overdue",
};
export function stem(w: string): string {
  const one = stem1(w);
  return one !== w && one.length > 4 ? stem1(one) : one;
}
function stem1(w: string): string {
  if (SYN[w]) return SYN[w];
  let s = w;
  if (s.length > 4 && s.endsWith("ies")) s = s.slice(0, -3) + "y";
  else if (s.length > 5 && s.endsWith("ing")) s = s.slice(0, -3);
  else if (s.length > 3 && s.endsWith("ed")) s = s.slice(0, -2);
  else if (s.length > 4 && s.endsWith("es")) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss") && !s.endsWith("us")) s = s.slice(0, -1);
  return SYN[s] ?? s;
}
export function normalise(text: string): string {
  return String(text ?? "").toLowerCase().replace(/[\u2019']/g, "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9.\s-]/g, " ").replace(/\s+/g, " ").trim();
}
export function tokens(text: string, keepStop = false): string[] {
  const out: string[] = [];
  for (const raw of normalise(text).replace(/[.-]/g, " ").split(" ")) {
    if (!raw) continue;
    if (!keepStop && STOP.has(raw)) continue;
    out.push(stem(raw));
  }
  return out;
}
const BAD_TLD = new Set(["txt", "json", "xml", "md", "js", "ts", "png", "jpg", "pdf", "html", "css", "csv"]);
// A domain-looking token: label(.label)+.tld, tld 2-24 letters, not a file extension.
export function findDomain(text: string): string | null {
  const m = String(text ?? "").toLowerCase().match(/\b(?:https?:\/\/)?(?:www\.)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24})\b/);
  if (!m) return null;
  const d = m[1];
  const tld = d.split(".").pop()!;
  if (BAD_TLD.has(tld)) return null;
  return d;
}
