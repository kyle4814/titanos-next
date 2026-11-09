// View-model for the /pro#leads panel (plan D2: export-only). Pure: no network, no send path, no register lookup.
// Wraps the f269 engine and turns every failure into a typed error with a plain message, never NaN or a blank.
import { exportLeads, DRAFT_RULES, type Reason } from "./leads-export.ts";

export const RULES_VERSION = "DRAFT v1: pending legal sign-off, not a legal opinion";
export const MAX_ROWS = 500;

export const REASON_TEXT: Record<Reason, string> = {
  UNKNOWN: "A required field is missing or not recognised, so the row is held back rather than guessed.",
  OPTED_OUT: "This person has opted out, so the row is never exported.",
  NO_CONSENT: "The consent on this row is not enough for this channel in the buyer's country.",
  DNC_LISTED: "The do-not-contact reading says this number is listed, so the row is held back.",
};

export type LeadsErrorCode = "BAD_JSON" | "NOT_A_LIST" | "EMPTY" | "TOO_MANY" | "BAD_COUNTRY" | "UNSUPPORTED_COUNTRY";
export type DncInput = "unknown" | "clear" | "listed";
export type RowVerdict = { index: number; id: string; channel: string; allowed: boolean; reason: Reason | null; text: string };
export type LeadsView =
  | { ok: true; rulesVersion: string; method: string; csv: string; emitted: number; withheld: number; rows: RowVerdict[] }
  | { ok: false; code: LeadsErrorCode; message: string };

const ERR: Record<LeadsErrorCode, string> = {
  BAD_JSON: "The sample list is not valid JSON. Check the brackets and quotes, then try again.",
  NOT_A_LIST: "The sample list must be a JSON list of rows, for example [ { ... }, { ... } ].",
  EMPTY: "The sample list has no rows. Add at least one row to check.",
  TOO_MANY: `The sample list has more than ${MAX_ROWS} rows. Split it and check each part.`,
  BAD_COUNTRY: "Enter the buyer's country as a short code, for example AU.",
  UNSUPPORTED_COUNTRY: "There is no rule table for that country yet, so nothing can be exported. Supported: " + Object.keys(DRAFT_RULES).join(", ") + ".",
};
const fail = (code: LeadsErrorCode): LeadsView => ({ ok: false, code, message: ERR[code] });

export function checkLeads(listText: string, buyerCountry: string, dnc: DncInput): LeadsView {
  const code = typeof buyerCountry === "string" ? buyerCountry.trim().toUpperCase() : "";
  if (!/^[A-Z]{2,3}$/.test(code)) return fail("BAD_COUNTRY");
  if (!Object.hasOwn(DRAFT_RULES, code)) return fail("UNSUPPORTED_COUNTRY");
  let parsed: unknown;
  try { parsed = JSON.parse(String(listText)); } catch { return fail("BAD_JSON"); }
  if (!Array.isArray(parsed)) return fail("NOT_A_LIST");
  if (parsed.length === 0) return fail("EMPTY");
  if (parsed.length > MAX_ROWS) return fail("TOO_MANY");
  // dncClear input: a reading the buyer supplies for phone rows. Nothing here looks up any register.
  const list = parsed.map((r) => (dnc !== "unknown" && r && typeof r === "object" && !Array.isArray(r) && (r as { channel?: unknown }).channel === "phone" ? { ...(r as object), dncClear: dnc === "clear" } : r));
  const res = exportLeads(list, code);
  const refused = new Map(res.refusals.map((x) => [x.index, x.reason]));
  const rows: RowVerdict[] = list.map((r, index) => {
    const o = r && typeof r === "object" ? (r as Record<string, unknown>) : {};
    const reason = refused.get(index) ?? null;
    return {
      index, id: typeof o.id === "string" && o.id ? o.id : `row ${index + 1}`, channel: typeof o.channel === "string" && o.channel ? o.channel : "not given",
      allowed: reason === null, reason, text: reason === null ? "Allowed by the draft rules for this country." : REASON_TEXT[reason],
    };
  });
  return { ok: true, rulesVersion: RULES_VERSION, method: res.method, csv: res.csv, emitted: res.emitted, withheld: res.withheld, rows };
}

// SYNTHETIC example rows, shown to the buyer as an example only. Not real people.
export const SAMPLE_ROWS = [
  { id: "EX-1", name: "Example Person One", organisation: "Example Pty Ltd", channel: "email", entityType: "business", consent: "inferred", email: "one@example.invalid" },
  { id: "EX-2", name: "Example Person Two", channel: "email", entityType: "individual", consent: "none", email: "two@example.invalid" },
  { id: "EX-3", name: "Example Person Three", channel: "email", entityType: "individual", consent: "express", email: "three@example.invalid", optedOut: true },
  { id: "EX-4", name: "Example Person Four", channel: "phone", entityType: "individual", consent: "express", phone: "0400 000 004" },
];
export const SAMPLE_TEXT = JSON.stringify(SAMPLE_ROWS, null, 2);
