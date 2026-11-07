// Leads export engine (plan chapter 6, decision D2: export-only, the buyer sends from their own inbox).
// PURE: no imports, no network, no model call, no send path. The only clock is the injected one.
// The rules table below is a DRAFT for legal review (CORE GATE7). It is not a legal opinion.
// Every row passes the gate BEFORE it can reach the CSV. Anything unknown fails closed to withheld.

export type Channel = "email" | "phone" | "sms" | "post";
export type EntityType = "individual" | "business";
export type Consent = "express" | "inferred" | "b2b_public" | "none" | "optout";
export type Reason = "UNKNOWN" | "OPTED_OUT" | "NO_CONSENT" | "DNC_LISTED";

export interface LeadRow {
  id: string;
  name?: string;
  organisation?: string;
  email?: string;
  phone?: string;
  address?: string;
  channel?: Channel;
  entityType?: EntityType;
  consent?: Consent;
  dncClear?: boolean;
  optedOut?: boolean;
}

export interface ChannelRule {
  individual: readonly Consent[];
  business: readonly Consent[];
  needsDncClear: boolean;
}
export type CountryRules = Record<Channel, ChannelRule>;
export type RulesTable = Record<string, CountryRules>;

export interface Refusal { index: number; id: string; reason: Reason }
export interface ExportResult { csv: string; refusals: Refusal[]; method: string; emitted: number; withheld: number }
export interface ExportOptions { rules?: RulesTable; now?: () => number }

const r = (individual: Consent[], business: Consent[], needsDncClear = false): ChannelRule => ({ individual, business, needsDncClear });
const NONE: ChannelRule = r([], []);

// DRAFT per-country channel-by-consent rules, held as data. Legal sign-off is PENDING.
export const DRAFT_RULES: RulesTable = {
  AU: {
    email: r(["express", "inferred"], ["express", "inferred", "b2b_public"]),
    sms: r(["express", "inferred"], ["express", "inferred"]),
    phone: r(["express", "inferred"], ["express", "inferred", "b2b_public"], true),
    post: r(["express", "inferred"], ["express", "inferred", "b2b_public"]),
  },
  NZ: {
    email: r(["express", "inferred"], ["express", "inferred", "b2b_public"]),
    sms: r(["express", "inferred"], ["express", "inferred"]),
    phone: r(["express", "inferred"], ["express", "inferred", "b2b_public"], true),
    post: r(["express", "inferred"], ["express", "inferred", "b2b_public"]),
  },
  UK: {
    email: r(["express"], ["express", "inferred", "b2b_public"]),
    sms: r(["express"], ["express"]),
    phone: r(["express"], ["express", "inferred", "b2b_public"], true),
    post: r(["express", "inferred"], ["express", "inferred", "b2b_public"]),
  },
  EU: {
    email: r(["express"], ["express", "inferred"]),
    sms: r(["express"], ["express"]),
    phone: r(["express"], ["express", "inferred"], true),
    post: r(["express", "inferred"], ["express", "inferred", "b2b_public"]),
  },
  US: {
    email: r(["express", "inferred", "b2b_public"], ["express", "inferred", "b2b_public"]),
    sms: r(["express"], ["express"], true),
    phone: r(["express", "inferred"], ["express", "inferred", "b2b_public"], true),
    post: r(["express", "inferred", "b2b_public"], ["express", "inferred", "b2b_public"]),
  },
};

export const COLUMNS = ["id", "name", "organisation", "channel", "entity_type", "consent", "email", "phone", "address"] as const;

const CHANNELS: readonly string[] = ["email", "phone", "sms", "post"];
const ENTITIES: readonly string[] = ["individual", "business"];
const CONSENTS: readonly string[] = ["express", "inferred", "b2b_public", "none", "optout"];

const FORMULA_RX = /^[\t\r ]*[=+\-@]|^[\t\r]/;

// A cell that a spreadsheet could read as a formula gets a leading apostrophe, so it stays text.
export function neutralise(s: string): string {
  if (FORMULA_RX.test(s)) return "'" + s;
  return s;
}

export function csvCell(v: unknown): string {
  const s = neutralise(typeof v === "string" ? v : "");
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const present = (v: unknown): boolean => typeof v === "string" && v.trim() !== "";

type Verdict = { ok: true } | { ok: false; reason: Reason };
const deny = (reason: Reason): Verdict => ({ ok: false, reason });

function gateRow(row: unknown, rules: CountryRules | null): Verdict {
  if (rules === null || typeof row !== "object" || row === null) return deny("UNKNOWN");
  const x = row as Record<string, unknown>;
  const channel = x.channel, entity = x.entityType, consent = x.consent;
  if (typeof channel !== "string" || !CHANNELS.includes(channel)) return deny("UNKNOWN");
  if (typeof entity !== "string" || !ENTITIES.includes(entity)) return deny("UNKNOWN");
  if (typeof consent !== "string" || !CONSENTS.includes(consent)) return deny("UNKNOWN");
  const contact = channel === "email" ? x.email : channel === "post" ? x.address : x.phone;
  if (!present(contact)) return deny("UNKNOWN");
  if (x.optedOut === true || consent === "optout") return deny("OPTED_OUT");
  const rule = Object.hasOwn(rules, channel) ? rules[channel as Channel] : NONE;
  const allowed = entity === "individual" ? rule.individual : rule.business;
  if (!allowed.includes(consent as Consent)) return deny("NO_CONSENT");
  if (rule.needsDncClear) {
    if (typeof x.dncClear !== "boolean") return deny("UNKNOWN");
    if (!x.dncClear) return deny("DNC_LISTED");
  }
  return { ok: true };
}

function cmp(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }

export function exportLeads(rows: readonly unknown[], buyerCountry: string, opts: ExportOptions = {}): ExportResult {
  const table = opts.rules ?? DRAFT_RULES;
  const now = opts.now ?? (() => 0);
  const t = now();
  const code = typeof buyerCountry === "string" ? buyerCountry.trim().toUpperCase() : "";
  const rules = Object.hasOwn(table, code) ? table[code] : null;

  const keep: { index: number; id: string; row: Record<string, unknown> }[] = [];
  const refusals: Refusal[] = [];
  const list = Array.isArray(rows) ? rows : [];
  list.forEach((row, index) => {
    const id = typeof row === "object" && row !== null ? str((row as Record<string, unknown>).id) : "";
    const v = gateRow(row, rules);
    if (v.ok) keep.push({ index, id, row: row as Record<string, unknown> });
    else refusals.push({ index, id, reason: v.reason });
  });

  const order = (a: { id: string; index: number }, b: { id: string; index: number }) => cmp(a.id, b.id) || a.index - b.index;
  keep.sort(order);
  refusals.sort(order);

  const lines = [COLUMNS.join(",")];
  for (const k of keep) {
    const x = k.row;
    lines.push([x.id, x.name, x.organisation, x.channel, x.entityType, x.consent, x.email, x.phone, x.address].map(csvCell).join(","));
  }
  const csv = lines.join("\r\n") + "\r\n";
  const method = `leads-export v1 | buyer=${rules === null ? "UNKNOWN" : code} | rules=DRAFT for legal review, not a legal opinion | gate runs before every row | rows=${list.length} emitted=${keep.length} withheld=${refusals.length} | asOf=${new Date(Number.isFinite(t) ? t : 0).toISOString()} | export only, no send path`;
  return { csv, refusals, method, emitted: keep.length, withheld: refusals.length };
}
