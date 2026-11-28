// Email spoofing check: pure logic (no React, no imports) so it runs in the browser and under node tests.
// Reads PUBLIC DNS only, through a DNS-over-HTTPS JSON resolver (Cloudflare, application/dns-json).
// Honest by construction: a lookup that fails is "unknown", never "safe".

export const DOH_URL = "https://cloudflare-dns.com/dns-query";

/** Common DKIM selectors. DKIM selectors are chosen by the sender, so absence here proves nothing. */
export const DKIM_SELECTORS: { selector: string; hint: string }[] = [
  { selector: "google", hint: "Google Workspace" },
  { selector: "selector1", hint: "Microsoft 365" },
  { selector: "selector2", hint: "Microsoft 365" },
  { selector: "default", hint: "common default" },
  { selector: "dkim", hint: "common default" },
  { selector: "mail", hint: "common default" },
  { selector: "s1", hint: "SendGrid or similar" },
  { selector: "s2", hint: "SendGrid or similar" },
  { selector: "k1", hint: "Mailchimp" },
  { selector: "k2", hint: "Mailchimp" },
  { selector: "k3", hint: "Mailchimp" },
  { selector: "mandrill", hint: "Mandrill" },
  { selector: "zmail", hint: "Zoho Mail" },
  { selector: "protonmail", hint: "Proton Mail" },
  { selector: "fm1", hint: "Fastmail" },
  { selector: "fm2", hint: "Fastmail" },
  { selector: "mxvault", hint: "common default" },
  { selector: "smtp", hint: "common default" },
];

export type DohAnswer = { name: string; type: number; TTL?: number; data: string };
export type DohResult = { ok: boolean; status: number; answers: DohAnswer[]; error?: string };
export type Fetcher = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

// ---------- domain input ----------

const SECOND_LEVEL_SUFFIXES = new Set([
  "com.au", "net.au", "org.au", "edu.au", "gov.au", "asn.au", "id.au",
  "co.nz", "net.nz", "org.nz", "govt.nz", "ac.nz",
  "com.sg", "edu.sg", "gov.sg", "org.sg", "net.sg",
  "co.uk", "org.uk", "ac.uk", "gov.uk",
]);

/** Accepts "https://www.example.com.au/path", "name@example.com.au" or a bare domain. Returns null if it cannot be a domain. */
export function normaliseDomain(input: string): string | null {
  let s = (input || "").trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  if (s.includes("@")) s = s.slice(s.lastIndexOf("@") + 1);
  s = s.split(/[/?#:\s]/)[0] ?? "";
  s = s.replace(/^\.+|\.+$/g, "");
  if (!s || s.length > 253 || !s.includes(".")) return null;
  // Convert internationalised names with the platform's URL parser (same punycode rules browsers use).
  try {
    s = new URL(`http://${s}`).hostname;
  } catch {
    return null;
  }
  const labels = s.split(".");
  if (labels.some((l) => !l || l.length > 63 || !/^[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?$/.test(l))) return null;
  if (/^\d+(\.\d+){3}$/.test(s)) return null;
  if (labels[labels.length - 1]!.length < 2) return null;
  return s;
}

/** The registrable (organisational) domain, using a short list of multi-part suffixes common in AU, NZ, SG and UK. */
export function organisationalDomain(domain: string): string {
  const labels = domain.split(".");
  if (labels.length <= 2) return domain;
  const last2 = labels.slice(-2).join(".");
  if (SECOND_LEVEL_SUFFIXES.has(last2)) return labels.slice(-3).join(".");
  return labels.slice(-2).join(".");
}

// ---------- DNS over HTTPS ----------

/** Join a TXT answer that Cloudflare returns as one or more quoted chunks: "v=spf1 ..." "...rest". */
export function unquoteTxt(data: string): string {
  const chunks = [...data.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]!.replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
  return chunks.length ? chunks.join("") : data.trim();
}

export async function dohQuery(name: string, type: "TXT" | "MX", fetcher: Fetcher, timeoutMs = 8000): Promise<DohResult> {
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : undefined;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : undefined;
  try {
    const res = await fetcher(`${DOH_URL}?name=${encodeURIComponent(name)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
      signal: ctl?.signal,
    });
    if (!res.ok) return { ok: false, status: -1, answers: [], error: `resolver returned HTTP ${res.status}` };
    const body = (await res.json()) as { Status?: number; Answer?: DohAnswer[] };
    const status = typeof body.Status === "number" ? body.Status : -1;
    // 0 = NOERROR, 3 = NXDOMAIN (name does not exist). Anything else (SERVFAIL = 2, REFUSED = 5) is unknown, not "absent".
    const ok = status === 0 || status === 3;
    return { ok, status, answers: Array.isArray(body.Answer) ? body.Answer : [], error: ok ? undefined : `resolver status ${status}` };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, status: -1, answers: [], error: aborted ? "lookup timed out" : "lookup failed" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const TXT = 16;
const MX = 15;

function txtRecords(r: DohResult): string[] {
  return r.answers.filter((a) => a.type === TXT).map((a) => unquoteTxt(a.data));
}

// ---------- SPF ----------

export type Severity = "good" | "warn" | "bad" | "unknown";
export type Finding = { severity: Severity; title: string; detail: string; fix?: string };

export type SpfAnalysis = {
  found: boolean;
  lookedUp: boolean;
  record?: string;
  count: number;
  all?: "-all" | "~all" | "?all" | "+all" | "none";
  redirect?: string;
  lookups: number;
  lookupsAtLeast: boolean;
  findings: Finding[];
  includes: string[];
};

const SPF_LOOKUP_MECHANISMS = /^(include|a|mx|ptr|exists|redirect)(?=[:/=]|$)/i;

export function parseSpfTerms(record: string): { mechanisms: string[]; all: SpfAnalysis["all"]; redirect?: string; includes: string[]; lookupTerms: number } {
  const terms = record.trim().split(/\s+/).slice(1);
  let all: SpfAnalysis["all"] = "none";
  let redirect: string | undefined;
  const includes: string[] = [];
  let lookupTerms = 0;
  for (const raw of terms) {
    const t = raw.replace(/^[+\-~?]/, "");
    const lower = t.toLowerCase();
    if (lower === "all") {
      const q = raw[0];
      all = q === "-" ? "-all" : q === "~" ? "~all" : q === "?" ? "?all" : "+all";
      continue;
    }
    if (lower.startsWith("redirect=")) {
      redirect = t.slice(9);
      lookupTerms += 1;
      continue;
    }
    if (lower.startsWith("include:")) includes.push(t.slice(8));
    if (SPF_LOOKUP_MECHANISMS.test(t)) lookupTerms += 1;
  }
  return { mechanisms: terms, all, redirect, includes, lookupTerms };
}

export async function analyseSpf(domain: string, fetcher: Fetcher): Promise<SpfAnalysis> {
  const findings: Finding[] = [];
  const base: SpfAnalysis = { found: false, lookedUp: false, count: 0, lookups: 0, lookupsAtLeast: false, findings, includes: [] };
  const root = await dohQuery(domain, "TXT", fetcher);
  if (!root.ok) {
    findings.push({ severity: "unknown", title: "SPF could not be read", detail: `The public DNS lookup did not complete (${root.error}). That is an unknown, not a pass.`, fix: "Try again in a minute. If it keeps failing, ask your IT provider to read the TXT records for the domain." });
    return base;
  }
  base.lookedUp = true;
  const spfs = txtRecords(root).filter((t) => /^v=spf1(\s|$)/i.test(t.trim()));
  base.count = spfs.length;
  if (spfs.length === 0) {
    findings.push({
      severity: "bad",
      title: "No SPF record found",
      detail: "SPF is the public list of servers allowed to send email for your domain. Without it, receiving mail systems have nothing to check a sender against.",
      fix: "Publish one TXT record at your domain that starts v=spf1 and lists your real mail senders, then ends in ~all (and later -all). Your email provider's help page gives the exact include to use.",
    });
    return base;
  }
  base.found = true;
  base.record = spfs[0];
  if (spfs.length > 1) {
    findings.push({
      severity: "bad",
      title: `${spfs.length} SPF records found (only one is allowed)`,
      detail: "RFC 7208 allows exactly one SPF record per domain. With two, many receivers treat SPF as broken (a permanent error) and ignore both.",
      fix: "Merge the senders from both records into one v=spf1 record and delete the other.",
    });
  }
  const parsed = parseSpfTerms(spfs[0]!);
  base.all = parsed.all;
  base.redirect = parsed.redirect;
  base.includes = parsed.includes;

  // Count DNS lookups recursively (limit 10 under RFC 7208 section 4.6.4), capped so a hostile record cannot make us query forever.
  let lookups = parsed.lookupTerms;
  let atLeast = false;
  const seen = new Set<string>([domain]);
  let queries = 0;
  const QUERY_CAP = 14;
  const walk = async (targets: string[], depth: number): Promise<void> => {
    for (const target of targets) {
      const t = target.toLowerCase();
      if (seen.has(t)) continue;
      seen.add(t);
      if (depth >= 5 || queries >= QUERY_CAP) {
        atLeast = true;
        continue;
      }
      queries += 1;
      const r = await dohQuery(t, "TXT", fetcher);
      const rec = txtRecords(r).find((x) => /^v=spf1(\s|$)/i.test(x.trim()));
      if (!rec) continue;
      const p = parseSpfTerms(rec);
      lookups += p.lookupTerms;
      const next = [...p.includes, ...(p.redirect ? [p.redirect] : [])];
      await walk(next, depth + 1);
    }
  };
  await walk([...parsed.includes, ...(parsed.redirect ? [parsed.redirect] : [])], 1);
  base.lookups = lookups;
  base.lookupsAtLeast = atLeast;

  if (lookups > 10) {
    findings.push({
      severity: "bad",
      title: `SPF needs ${atLeast ? "at least " : ""}${lookups} DNS lookups (the limit is 10)`,
      detail: "Over 10 lookups, SPF fails with a permanent error and receivers may treat your real email as unauthenticated. This is common after adding several email and marketing tools.",
      fix: "Remove senders you no longer use, or ask your IT provider to flatten the record.",
    });
  }
  if (parsed.all === "+all") {
    findings.push({ severity: "bad", title: "SPF ends in +all, which allows everyone", detail: "+all tells receivers that any server in the world may send as your domain. It is worse than having no SPF record.", fix: "Replace +all with ~all now, then -all once you are sure every real sender is listed." });
  } else if (parsed.all === "?all") {
    findings.push({ severity: "warn", title: "SPF ends in ?all (neutral)", detail: "Neutral means the record makes no claim either way, so it adds almost no protection.", fix: "Change ?all to ~all, then to -all once every real sender is listed." });
  } else if (parsed.all === "~all") {
    findings.push({ severity: "good", title: "SPF is in place and ends in ~all (soft fail)", detail: "Mail from unlisted servers is marked suspicious. This is a sensible setting while DMARC is doing the enforcing." });
  } else if (parsed.all === "-all") {
    findings.push({ severity: "good", title: "SPF is in place and ends in -all (hard fail)", detail: "Mail from servers you have not listed should be rejected. Keep the list of real senders up to date, because a forgotten sender will be blocked." });
  } else if (!parsed.redirect) {
    findings.push({ severity: "warn", title: "SPF has no closing all mechanism", detail: "Without an all at the end, mail from unlisted servers falls through with no verdict.", fix: "End the record with ~all (or -all once every real sender is listed)." });
  }
  if (parsed.mechanisms.some((m) => /^[+\-~?]?ptr(:|$)/i.test(m))) {
    findings.push({ severity: "warn", title: "SPF uses the ptr mechanism", detail: "RFC 7208 says not to use ptr: it is slow and unreliable.", fix: "Replace it with ip4, ip6 or include entries." });
  }
  return base;
}

// ---------- DMARC ----------

export type DmarcAnalysis = {
  found: boolean;
  lookedUp: boolean;
  record?: string;
  source?: string;
  policy?: "none" | "quarantine" | "reject";
  subdomainPolicy?: string;
  pct: number;
  rua?: string;
  ruf?: string;
  adkim?: string;
  aspf?: string;
  count: number;
  findings: Finding[];
};

export function parseDmarcTags(record: string): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const part of record.split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    const k = part.slice(0, i).trim().toLowerCase();
    const v = part.slice(i + 1).trim();
    if (k && !(k in tags)) tags[k] = v;
  }
  return tags;
}

export async function analyseDmarc(domain: string, fetcher: Fetcher): Promise<DmarcAnalysis> {
  const findings: Finding[] = [];
  const out: DmarcAnalysis = { found: false, lookedUp: false, pct: 100, count: 0, findings };
  const org = organisationalDomain(domain);
  const candidates = org !== domain ? [domain, org] : [domain];
  let usedName = "";
  let records: string[] = [];
  let anyFailed = false;
  let anyOk = false;
  for (const name of candidates) {
    const r = await dohQuery(`_dmarc.${name}`, "TXT", fetcher);
    if (!r.ok) {
      anyFailed = true;
      continue;
    }
    anyOk = true;
    const found = txtRecords(r).filter((t) => /^v=DMARC1\s*(;|$)/i.test(t.trim()));
    if (found.length) {
      records = found;
      usedName = name;
      break;
    }
  }
  if (!anyOk) {
    findings.push({ severity: "unknown", title: "DMARC could not be read", detail: "The public DNS lookup did not complete. That is an unknown, not a pass.", fix: "Try again in a minute." });
    return out;
  }
  out.lookedUp = true;
  if (!records.length) {
    if (anyFailed) {
      findings.push({ severity: "unknown", title: "DMARC not found, but one lookup failed", detail: "No DMARC record came back, though a lookup did not complete. Treat this as unconfirmed and run the check again." });
      return out;
    }
    findings.push({
      severity: "bad",
      title: "No DMARC record found",
      detail: "DMARC is the instruction that tells receiving mail systems what to do with email that claims to be from you but fails the checks. With no record, a fake email using your domain in the From line has no published rule against it.",
      fix: `Start in monitoring mode: add a TXT record at _dmarc.${domain} with the value  v=DMARC1; p=none; rua=mailto:dmarc-reports@${org}  (use a mailbox you actually read). Move to quarantine and then reject once the reports show your real senders passing.`,
    });
    return out;
  }
  out.found = true;
  out.count = records.length;
  out.record = records[0];
  out.source = usedName;
  if (records.length > 1) {
    findings.push({ severity: "bad", title: `${records.length} DMARC records found (only one is allowed)`, detail: "With more than one DMARC record, receivers ignore DMARC entirely.", fix: "Delete the extra record so one remains." });
  }
  if (usedName !== domain) {
    findings.push({ severity: "good", title: `Using the DMARC policy of ${usedName}`, detail: `${domain} has no record of its own, so receivers fall back to the policy of its parent domain ${usedName}.` });
  }
  const tags = parseDmarcTags(records[0]!);
  const p = (tags["p"] || "").toLowerCase();
  out.subdomainPolicy = tags["sp"];
  out.rua = tags["rua"];
  out.ruf = tags["ruf"];
  out.adkim = tags["adkim"];
  out.aspf = tags["aspf"];
  const pct = tags["pct"] !== undefined ? Number(tags["pct"]) : 100;
  out.pct = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 100;

  if (p === "reject" || p === "quarantine" || p === "none") {
    out.policy = p;
  } else {
    findings.push({ severity: "bad", title: "DMARC record has no valid p= policy", detail: "A DMARC record must carry p=none, p=quarantine or p=reject. Without it receivers treat the record as invalid.", fix: "Add p=none first, then tighten." });
    return out;
  }
  if (p === "reject") {
    findings.push({ severity: "good", title: "DMARC policy is reject (strongest)", detail: "Mail that claims to be from your domain and fails both checks should be refused by receivers that honour DMARC. This is the setting that actually answers the question: no, a stranger cannot easily send as you." });
  } else if (p === "quarantine") {
    findings.push({ severity: "good", title: "DMARC policy is quarantine", detail: "Fake mail should be sent to spam. Good. Once the reports are clean, reject is the final step.", fix: "When your reports show only real senders passing, change p=quarantine to p=reject." });
  } else {
    findings.push({ severity: "bad", title: "DMARC policy is none (monitor only)", detail: "p=none collects reports but tells receivers to deliver fake mail anyway. It is the right first step, and a poor place to stay: it does not stop anyone sending as your business.", fix: "Read the reports for two to four weeks, fix any real sender that fails, then move to p=quarantine and then p=reject." });
  }
  if (out.policy !== "none" && out.pct < 100) {
    findings.push({ severity: "warn", title: `Policy applies to only ${out.pct}% of failing mail`, detail: `pct=${out.pct} means ${100 - out.pct}% of failing mail is treated as if the policy were weaker.`, fix: "Raise pct to 100 once the reports are clean." });
  }
  if (tags["sp"] && out.policy && out.policy !== "none" && tags["sp"].toLowerCase() === "none") {
    findings.push({ severity: "warn", title: "Subdomains are left on monitor only (sp=none)", detail: "Someone can send as mail.yourdomain even though the main domain is protected.", fix: "Remove sp= (subdomains then inherit p) or set it to match p." });
  }
  if (!out.rua) {
    findings.push({ severity: "warn", title: "No aggregate reports address (rua)", detail: "Without rua you receive no reports, so you cannot see who is sending as you or whether your real senders pass.", fix: `Add rua=mailto:dmarc-reports@${org} (a mailbox you read, or a free report-reading service).` });
  } else {
    findings.push({ severity: "good", title: "Aggregate reports are switched on (rua)", detail: "You are receiving the daily summaries that show who is sending as your domain." });
  }
  return out;
}

// ---------- DKIM and MX ----------

export type DkimHit = { selector: string; hint: string; kind: "key" | "cname" };
export type DkimAnalysis = { checked: number; failed: number; hits: DkimHit[]; findings: Finding[] };

export async function analyseDkim(domain: string, fetcher: Fetcher): Promise<DkimAnalysis> {
  const results = await Promise.all(
    DKIM_SELECTORS.map(async (s) => ({ s, r: await dohQuery(`${s.selector}._domainkey.${domain}`, "TXT", fetcher) })),
  );
  const hits: DkimHit[] = [];
  let failed = 0;
  for (const { s, r } of results) {
    if (!r.ok) {
      failed += 1;
      continue;
    }
    const txt = txtRecords(r).find((t) => /(^|;)\s*v=DKIM1/i.test(t) || /(^|;)\s*p=[A-Za-z0-9+/=]{20,}/.test(t));
    if (txt) hits.push({ selector: s.selector, hint: s.hint, kind: "key" });
    else if (r.answers.some((a) => a.type === 5) && r.answers.some((a) => a.type === TXT)) hits.push({ selector: s.selector, hint: s.hint, kind: "cname" });
  }
  const findings: Finding[] = [];
  if (hits.length) {
    findings.push({ severity: "good", title: `DKIM key found (${hits.map((h) => h.selector).join(", ")})`, detail: "A DKIM signing key is published, so at least one of your senders can sign its mail. Each sender (your mailbox provider, your newsletter tool, your invoicing system) needs its own." });
  } else if (failed === DKIM_SELECTORS.length) {
    findings.push({ severity: "unknown", title: "DKIM could not be checked", detail: "The public DNS lookups did not complete. That is an unknown, not a pass." });
  } else {
    findings.push({
      severity: "warn",
      title: "No DKIM key found on the common selectors",
      detail: `This does not prove DKIM is missing. The sender picks the selector name, and I tried ${DKIM_SELECTORS.length} common ones only. It does mean this check cannot confirm DKIM.`,
      fix: "Ask your email provider for the DKIM selector and check it is switched on. Google Workspace and Microsoft 365 both have a DKIM setting in the admin console.",
    });
  }
  return { checked: DKIM_SELECTORS.length, failed, hits, findings };
}

export type MxAnalysis = { lookedUp: boolean; hosts: string[]; provider?: string };

export async function analyseMx(domain: string, fetcher: Fetcher): Promise<MxAnalysis> {
  const r = await dohQuery(domain, "MX", fetcher);
  if (!r.ok) return { lookedUp: false, hosts: [] };
  const hosts = r.answers.filter((a) => a.type === MX).map((a) => a.data.split(/\s+/).pop()!.replace(/\.$/, "").toLowerCase());
  const joined = hosts.join(" ");
  const provider = /google\.com|googlemail\.com/.test(joined) ? "Google Workspace" : /outlook\.com|protection\.outlook/.test(joined) ? "Microsoft 365" : /zoho\./.test(joined) ? "Zoho Mail" : /protonmail|proton\.ch/.test(joined) ? "Proton Mail" : /messagingengine\.com/.test(joined) ? "Fastmail" : /mimecast/.test(joined) ? "Mimecast" : undefined;
  return { lookedUp: true, hosts, provider };
}

// ---------- verdict ----------

export type Verdict = {
  level: "protected" | "partial" | "exposed" | "unknown";
  headline: string;
  answer: string;
};

export type FullResult = {
  domain: string;
  checkedAt: string;
  spf: SpfAnalysis;
  dmarc: DmarcAnalysis;
  dkim: DkimAnalysis;
  mx: MxAnalysis;
  verdict: Verdict;
};

export function decideVerdict(spf: SpfAnalysis, dmarc: DmarcAnalysis, dkim: DkimAnalysis): Verdict {
  if (!spf.lookedUp && !dmarc.lookedUp) {
    return { level: "unknown", headline: "Could not complete the check", answer: "The public DNS lookups did not complete, so there is no result to give. Nothing here means your domain is safe or unsafe. Try again." };
  }
  const enforcing = dmarc.found && (dmarc.policy === "quarantine" || dmarc.policy === "reject");
  const spfOk = spf.found && spf.count === 1 && spf.all !== "+all" && spf.all !== "?all" && spf.all !== "none" && spf.lookups <= 10;
  const dkimOk = dkim.hits.length > 0;
  if (enforcing && (spfOk || dkimOk)) {
    const strong = dmarc.policy === "reject" && dmarc.pct === 100;
    return {
      level: strong && spfOk && dkimOk ? "protected" : "partial",
      headline: strong && spfOk && dkimOk ? "Hard to fake: your domain tells receivers to refuse spoofed mail" : "Mostly closed: spoofed mail should be quarantined or refused, with gaps to tidy",
      answer: strong && spfOk && dkimOk
        ? "Not easily. Your records tell receiving mail systems that honour DMARC to refuse mail that claims to be from your domain and fails the checks. Receivers choose how they act, so this is strong, not absolute."
        : "Someone can still try, but receivers that honour DMARC should send failing mail to spam or refuse it. The items below close the remaining gaps.",
    };
  }
  if (dmarc.found && dmarc.policy === "none") {
    return { level: "exposed", headline: "Open: DMARC is only watching, it is not blocking", answer: "Yes, today a stranger can send email that claims to be from your business and most receivers will still deliver it. Your DMARC record is in monitor-only mode (p=none). That is a sensible first step but it blocks nothing." };
  }
  if (!dmarc.found && dmarc.lookedUp) {
    return { level: "exposed", headline: "Open: no DMARC record, so spoofed mail has no rule against it", answer: spf.found ? "Yes, in practice. You have SPF, but with no DMARC record receivers have no instruction on what to do with fake mail that uses your domain in the From line, and SPF alone does not check the address your customers actually see." : "Yes. There is no SPF and no DMARC record, so nothing published stops someone sending email that claims to be from your business." };
  }
  return { level: "unknown", headline: "Partly checked: some lookups did not complete", answer: "Some of the public DNS lookups did not complete, so this result is incomplete. Run the check again before relying on it." };
}

export async function runCheck(rawDomain: string, fetcher: Fetcher): Promise<FullResult | { error: string }> {
  const domain = normaliseDomain(rawDomain);
  if (!domain) return { error: "That does not look like a domain. Try something like yourbusiness.com.au" };
  const [spf, dmarc, dkim, mx] = await Promise.all([analyseSpf(domain, fetcher), analyseDmarc(domain, fetcher), analyseDkim(domain, fetcher), analyseMx(domain, fetcher)]);
  return { domain, checkedAt: new Date().toISOString(), spf, dmarc, dkim, mx, verdict: decideVerdict(spf, dmarc, dkim) };
}

/** Plain-text summary for "send this to your IT person". Built in the browser, never transmitted. */
export function summaryText(r: FullResult): string {
  const lines: string[] = [];
  lines.push(`Email spoofing check for ${r.domain}`);
  lines.push(`Checked ${r.checkedAt.slice(0, 10)} from public DNS (SPF, DKIM, DMARC) via titanos.tech/tools/email-spoofing-check`);
  lines.push("");
  lines.push(`RESULT: ${r.verdict.headline}`);
  lines.push(r.verdict.answer);
  const add = (title: string, f: Finding[]) => {
    lines.push("");
    lines.push(title);
    for (const x of f) {
      lines.push(`- [${x.severity.toUpperCase()}] ${x.title}. ${x.detail}${x.fix ? ` Fix: ${x.fix}` : ""}`);
    }
  };
  add("SPF", r.spf.findings);
  if (r.spf.record) lines.push(`  Record: ${r.spf.record}`);
  add("DMARC", r.dmarc.findings);
  if (r.dmarc.record) lines.push(`  Record: ${r.dmarc.record}`);
  add("DKIM", r.dkim.findings);
  return lines.join("\n");
}
