// Pure SPF maths for the SPF builder. No network, no storage: runs in the browser and in the test.
// Lookup rules: RFC 7208 section 4.6.4 (10 DNS-querying terms per check) and, for the count per mechanism,
// Microsoft Learn "Set up SPF" (include, a, mx, exists, redirect count one each; ip4, ip6 and all do not).
// We also count ptr, which RFC 7208 counts and says never to use.

export type ProviderStatus = "provider-doc" | "third-party" | "none-published";

export type Provider = {
  id: string;
  name: string;
  use: string;
  /** The include: target, or null when we could not find one the provider publishes. */
  include: string | null;
  status: ProviderStatus;
  source: { label: string; url: string };
  note: string;
};

// Every include below was checked on 2026-11-29. Where a provider does not publish an SPF include we say so
// instead of guessing one: a made-up include can authorise strangers or break the record.
export const PROVIDERS: Provider[] = [
  {
    id: "google",
    name: "Google Workspace",
    use: "Gmail on your own domain",
    include: "_spf.google.com",
    status: "provider-doc",
    source: { label: "Google Workspace Admin Help, Set up SPF", url: "https://knowledge.workspace.google.com/admin/security/set-up-spf" },
    note: "Google's own example record is v=spf1 include:_spf.google.com ~all.",
  },
  {
    id: "microsoft",
    name: "Microsoft 365",
    use: "Outlook and Exchange Online on your own domain",
    include: "spf.protection.outlook.com",
    status: "provider-doc",
    source: { label: "Microsoft Learn, Set up SPF in Microsoft 365", url: "https://learn.microsoft.com/en-us/defender-office-365/email-authentication-spf-configure" },
    note: "Government and 21Vianet tenants use different values, listed on the Microsoft page. This is the standard commercial one.",
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    use: "Newsletters and campaigns",
    include: "servers.mcsv.net",
    status: "third-party",
    source: { label: "Mailchimp, set up email domain authentication", url: "https://mailchimp.com/de/help/about-email-authentication" },
    note: "Mailchimp's own help page asks for DKIM and DMARC records and does not mention SPF. The include servers.mcsv.net comes from third-party setup guides, not from Mailchimp's documentation. Most senders do not need it, and it costs a lookup.",
  },
  {
    id: "xero",
    name: "Xero",
    use: "Invoice and quote emails",
    include: null,
    status: "none-published",
    source: { label: "Xero Product Ideas, sending from your own domain", url: "https://productideas.xero.com/forums/967115-invoices-quotes/suggestions/44960536-xero-mail-send-as-company-name-com-not-message" },
    note: "We found no SPF include published by Xero. Xero sends invoices from its own domain (post.xero.com), so your domain's SPF record does not need a Xero entry. Check Xero's current help before changing DNS.",
  },
  {
    id: "servicem8",
    name: "ServiceM8",
    use: "Job and quote emails",
    include: null,
    status: "none-published",
    source: { label: "ServiceM8 help, set up a Custom SMTP server", url: "https://support.servicem8.com/help-center/servicem8-add-ons/third-party-email-integrations/how-to-setup-a-custom-smtp-server.md" },
    note: "We found no SPF include published by ServiceM8. If you use its Custom SMTP add-on, mail leaves through your own mail host, so the SPF entry is your mail host's (Google Workspace or Microsoft 365 above). Ask ServiceM8 support to confirm for your setup.",
  },
];

export type Policy = "-all" | "~all";

/** Join the picked provider includes, plus any extra includes and IPs, into one record string. */
export function buildRecord(opts: { providerIds: string[]; extraIncludes?: string[]; ip4?: string[]; ip6?: string[]; useMx?: boolean; policy: Policy }): string {
  const parts = ["v=spf1"];
  if (opts.useMx) parts.push("mx");
  for (const ip of opts.ip4 ?? []) parts.push(`ip4:${ip}`);
  for (const ip of opts.ip6 ?? []) parts.push(`ip6:${ip}`);
  const seen = new Set<string>();
  const add = (d: string) => { const k = d.trim().toLowerCase(); if (k && !seen.has(k)) { seen.add(k); parts.push(`include:${k}`); } };
  for (const id of opts.providerIds) { const p = PROVIDERS.find((x) => x.id === id); if (p?.include) add(p.include); }
  for (const d of opts.extraIncludes ?? []) add(d);
  parts.push(opts.policy);
  return parts.join(" ");
}

export type Term = { raw: string; kind: "version" | "include" | "a" | "mx" | "ptr" | "exists" | "redirect" | "ip4" | "ip6" | "all" | "exp" | "unknown"; qualifier: "+" | "-" | "~" | "?"; value: string; lookups: number };

const LOOKUP_KINDS = new Set(["include", "a", "mx", "ptr", "exists", "redirect"]);

export function parseTerms(record: string): Term[] {
  const out: Term[] = [];
  for (const raw of record.trim().split(/\s+/).filter(Boolean)) {
    if (/^v=spf1$/i.test(raw)) { out.push({ raw, kind: "version", qualifier: "+", value: "", lookups: 0 }); continue; }
    const m = /^([+\-~?])?([a-z0-9]+)(?:([:=\/])(.*))?$/i.exec(raw);
    if (!m) { out.push({ raw, kind: "unknown", qualifier: "+", value: raw, lookups: 0 }); continue; }
    const q = (m[1] as Term["qualifier"]) ?? "+";
    const name = m[2].toLowerCase();
    const sep = m[3];
    const value = m[4] ?? "";
    const known = ["include", "a", "mx", "ptr", "exists", "redirect", "ip4", "ip6", "all", "exp"];
    // redirect= and exp= use "=", every mechanism uses ":" (a and mx may also take "/cidr").
    const sepOk = name === "redirect" || name === "exp" ? sep === "=" : name === "a" || name === "mx" ? sep === ":" || sep === "/" || sep === undefined : name === "ptr" || name === "all" ? sep === undefined || sep === ":" : sep === ":";
    if (!known.includes(name) || !sepOk) { out.push({ raw, kind: "unknown", qualifier: q, value: raw, lookups: 0 }); continue; }
    const kind = name as Term["kind"];
    out.push({ raw, kind, qualifier: q, value: sep === "/" ? "/" + value : value, lookups: LOOKUP_KINDS.has(kind) ? 1 : 0 });
  }
  return out;
}

export type Level = "ok" | "warn" | "fail";
export type Finding = { level: Level; text: string };
export type Analysis = { terms: Term[]; lookups: number; level: Level; findings: Finding[] };

export const LIMIT = 10;
export const WARN_AT = 8;

/** Count the DNS lookups written directly in the record and list the faults a small business can fix.
 *  Nested lookups (an include that itself includes more) cannot be known without DNS, so the count is a minimum. */
export function analyse(record: string): Analysis {
  const findings: Finding[] = [];
  const text = record.trim();
  const terms = parseTerms(text);
  const lookups = terms.reduce((n, t) => n + t.lookups, 0);
  const add = (level: Level, t: string) => findings.push({ level, text: t });

  if (!text) return { terms, lookups: 0, level: "ok", findings: [{ level: "warn", text: "Paste an SPF record, or pick providers on the left to build one." }] };
  if (/\bv=spf1\b.*\bv=spf1\b/i.test(text)) add("fail", "This text holds two SPF records. A domain may publish only one SPF record: two make SPF return a permanent error. Merge them into one.");
  if (!/^v=spf1(\s|$)/i.test(text)) add("fail", "The record must start with v=spf1.");
  for (const t of terms) if (t.kind === "unknown") add("fail", `Unrecognised term "${t.raw}". Common slips: "include=" instead of "include:", a space after the colon, or a trailing full stop.`);
  for (const t of terms) if ((t.kind === "include" || t.kind === "exists" || t.kind === "redirect") && !t.value) add("fail", `"${t.raw}" has no domain after it.`);
  for (const t of terms) if (t.kind === "include" && /\.$/.test(t.value)) add("fail", `"${t.raw}" ends with a full stop. Remove it.`);
  const alls = terms.filter((t) => t.kind === "all");
  const last = terms[terms.length - 1];
  if (alls.length > 1) add("fail", "More than one all term. Keep a single all at the end.");
  if (alls.length === 1 && last !== alls[0]) add("warn", "Terms after all are ignored by receiving servers. Move all to the end.");
  const a = alls[0];
  if (!a && !terms.some((t) => t.kind === "redirect")) add("warn", "No all term at the end. Add ~all (soft fail) or -all (hard fail) so strangers are not given the benefit of the doubt.");
  if (a && a.qualifier === "+") add("fail", "+all (or a bare all) authorises every server on the internet to send as your domain. Replace it with ~all or -all.");
  if (a && a.qualifier === "?") add("warn", "?all says nothing either way, which gives no protection. Use ~all or -all once your senders are listed.");
  if (a && a.qualifier === "~") add("ok", "~all (soft fail) is a sensible start while you check DMARC reports. Move to -all once every sender is listed.");
  if (a && a.qualifier === "-") add("ok", "-all (hard fail) tells receivers to reject anything not listed. Make sure every legitimate sender is listed first.");
  if (terms.some((t) => t.kind === "ptr")) add("warn", "ptr is slow, unreliable and discouraged by RFC 7208. Replace it with explicit includes or IP ranges.");
  const seen = new Set<string>();
  for (const t of terms) if (t.kind === "include") { const k = t.value.toLowerCase(); if (seen.has(k)) add("warn", `include:${t.value} appears twice. Each copy costs a lookup.`); seen.add(k); }
  if (new TextEncoder().encode(text).length > 255) add("warn", "Over 255 characters. A single DNS text string holds 255 characters, so your DNS host must split this record into quoted chunks. Most hosts do it for you; check yours accepts a long value.");

  let level: Level = "ok";
  if (lookups > LIMIT) { add("fail", `${lookups} lookups written directly. The limit is ${LIMIT}. Past it, receivers return a permanent error and your mail can fail SPF.`); }
  else if (lookups >= WARN_AT) add("warn", `${lookups} of ${LIMIT} lookups used before counting nested ones. Each include can pull in more, so you may already be over.`);
  else if (lookups > 0) add("ok", `${lookups} of ${LIMIT} lookups written directly. Nested includes add more, so treat this as a minimum.`);
  if (findings.some((f) => f.level === "fail")) level = "fail";
  else if (findings.some((f) => f.level === "warn")) level = "warn";
  return { terms, lookups, level, findings };
}
