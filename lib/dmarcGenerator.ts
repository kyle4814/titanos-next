// DMARC record generator: pure logic (no React, no imports) so it runs in the browser and under node tests.
// Builds the TXT record value for _dmarc.<domain> per RFC 7489 section 6.3. Nothing is sent anywhere.

export type Policy = "none" | "quarantine" | "reject";
export type Alignment = "r" | "s";

export type DmarcInput = {
  domain?: string;
  policy: Policy;
  /** Policy for subdomains. "same" leaves the sp tag out, so subdomains follow p. */
  subPolicy?: Policy | "same";
  /** One or more report mailboxes, separated by commas, spaces or new lines. Plain addresses or mailto: forms. */
  rua?: string;
  /** Percentage of failing mail the policy applies to, 0 to 100. Default 100 (tag left out). */
  pct?: number;
  dkim?: Alignment;
  spf?: Alignment;
};

export type Note = { level: "ok" | "info" | "warn" | "error"; text: string };
export type TagLine = { tag: string; value: string; meaning: string };

export type DmarcOutput = {
  valid: boolean;
  host: string;
  value: string;
  /** The record as the DNS provider usually wants it: type TXT, name, value. */
  fields: { type: "TXT"; name: string; value: string };
  tags: TagLine[];
  notes: Note[];
};

const POLICIES: Policy[] = ["none", "quarantine", "reject"];
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/** Lower-case a typed domain and strip protocol, path, www-less mailbox forms and a trailing dot. Null if it is not a plausible domain. */
export function cleanDomain(raw: string | undefined): string | null {
  if (!raw) return null;
  let d = raw.trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, "").replace(/^.*@/, "").split(/[/?#:\s]/)[0].replace(/\.$/, "");
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)) return null;
  return d;
}

/** Split a rua box into clean addresses. Returns the good ones and the rejected strings. */
export function parseReportAddresses(raw: string | undefined): { good: string[]; bad: string[] } {
  const good: string[] = [];
  const bad: string[] = [];
  for (const part of (raw || "").split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)) {
    const addr = part.replace(/^mailto:/i, "");
    if (EMAIL.test(addr) && addr.length <= 254) {
      const a = addr.toLowerCase();
      if (!good.includes(a)) good.push(a);
    } else bad.push(part);
  }
  return { good, bad };
}

const hostOf = (addr: string) => addr.slice(addr.lastIndexOf("@") + 1);
/** Crude organisational-domain test for the external-reporting note: same name or a subdomain of the domain counts as inside. */
const inside = (host: string, domain: string) => host === domain || host.endsWith("." + domain) || domain.endsWith("." + host);

export function buildDmarc(input: DmarcInput): DmarcOutput {
  const notes: Note[] = [];
  let valid = true;
  const policy = POLICIES.includes(input.policy) ? input.policy : "none";
  if (policy !== input.policy) { notes.push({ level: "error", text: "Policy must be none, quarantine or reject." }); valid = false; }

  const domain = cleanDomain(input.domain);
  if (input.domain && input.domain.trim() && !domain) notes.push({ level: "warn", text: "That does not look like a domain such as example.com.au, so the host name below uses a placeholder." });

  const sub = input.subPolicy && input.subPolicy !== "same" && POLICIES.includes(input.subPolicy) ? input.subPolicy : null;

  let pct = 100;
  if (input.pct !== undefined && input.pct !== null && !Number.isNaN(input.pct)) {
    if (!Number.isInteger(input.pct) || input.pct < 0 || input.pct > 100) {
      notes.push({ level: "error", text: "The percentage must be a whole number from 0 to 100." });
      valid = false;
    } else pct = input.pct;
  }

  const { good, bad } = parseReportAddresses(input.rua);
  if (bad.length) { notes.push({ level: "error", text: `These report addresses are not valid email addresses: ${bad.join(", ")}.` }); valid = false; }

  const tags: TagLine[] = [{ tag: "v", value: "DMARC1", meaning: "The version. It must be the first tag in the record." }];
  const pMeaning: Record<Policy, string> = {
    none: "Monitor only. Receivers send you reports and still deliver failing mail.",
    quarantine: "Receivers treat failing mail as suspicious, usually the spam or junk folder.",
    reject: "Receivers refuse failing mail at the door.",
  };
  tags.push({ tag: "p", value: policy, meaning: pMeaning[policy] });
  if (sub) tags.push({ tag: "sp", value: sub, meaning: "The policy for subdomains such as mail.yourdomain. Without this tag, subdomains follow p." });
  if (pct !== 100) tags.push({ tag: "pct", value: String(pct), meaning: `Apply the policy to ${pct} percent of failing mail. The rest is handled one step softer.` });
  if (good.length) tags.push({ tag: "rua", value: good.map((a) => "mailto:" + a).join(","), meaning: "Where receivers send the daily aggregate reports." });
  if (input.dkim === "s") tags.push({ tag: "adkim", value: "s", meaning: "Strict DKIM alignment: the signing domain must match the From domain exactly. The default is relaxed." });
  if (input.spf === "s") tags.push({ tag: "aspf", value: "s", meaning: "Strict SPF alignment: the envelope sender domain must match the From domain exactly. The default is relaxed." });

  const value = tags.map((t) => `${t.tag}=${t.value}`).join("; ");
  const host = `_dmarc.${domain || "yourdomain.com.au"}`;

  if (valid) {
    if (!good.length) notes.push({ level: "warn", text: "No report address. The record still works, but you will not see who is sending as your domain, which is the whole point of the monitoring stage." });
    if (policy === "none" && pct !== 100) notes.push({ level: "info", text: "The percentage has no effect while the policy is none, because there is nothing to apply." });
    if (policy === "reject" && pct === 100) notes.push({ level: "warn", text: "Reject for all mail is the last stage, not the first. If a legitimate sender such as an invoicing or newsletter tool is not set up yet, its mail will be refused. Start at none, read the reports, then move up." });
    if (policy === "quarantine" && pct === 100) notes.push({ level: "info", text: "Quarantine for all mail is a good place to pause if you use several third-party senders. Read the reports first to be sure each one passes." });
    if (policy === "none") notes.push({ level: "ok", text: "A sensible first record. It blocks nothing, so it cannot stop your own mail, and it starts the reports." });
    if (pct === 0) notes.push({ level: "info", text: "A percentage of 0 applies the policy to none of the failing mail. Raise it in steps once the reports look clean." });
    if (domain) {
      const outside = good.filter((a) => !inside(hostOf(a), domain));
      if (outside.length) notes.push({ level: "warn", text: `Reports go to a different domain (${[...new Set(outside.map(hostOf))].join(", ")}). That domain must publish a TXT record at ${domain}._report._dmarc.${[...new Set(outside.map(hostOf))][0]} with the value v=DMARC1, or receivers will not send reports there (RFC 7489 section 7.1). Report services give you this line.` });
    } else if (good.length) {
      notes.push({ level: "info", text: "If the report mailbox is on a different domain from the one you are protecting, that other domain needs a small authorisation record. Enter your domain above and the tool will tell you the exact name." });
    }
    notes.push({ level: "info", text: "Make sure SPF or DKIM is set up for every service that sends as your domain before you tighten the policy. DMARC passes when either one passes and lines up with the From address." });
  }

  return { valid, host, value, fields: { type: "TXT", name: host, value }, tags, notes };
}
