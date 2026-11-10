// White-label report model (plan D8 / C9 residual f279). Pure TypeScript, zero model calls, no network, no upload.
// Reuses the C1 scanner, the planted fixture DNS worlds and the fix-plan builder already on disk, so the sample is
// produced by the same code a live report would use. Everything here is SYNTHETIC: an invented domain on the
// reserved .example name, an invented agency, no real client. The feature is not switched on (D8: V2, after the soak).
import { runScan, type ScanResult } from "./guestscan/scan.ts";
import { fakeDoh, type World } from "./guestscan/fixtures.ts";
import { buildPlan, type FixPlan } from "./guestscan/fixes.ts";

export interface BrandTokens {
  partnerName: string; // shown in the header and footer, plain text only
  accent: string; // #RRGGBB, used for rules and the grade badge background
  ink: string; // #RRGGBB, body text
  paper: string; // #RRGGBB, page background
  logoSlot: { label: string; width: number; height: number }; // an empty, labelled box: no image is loaded in the sample
}

export const HEX = /^#[0-9a-fA-F]{6}$/;
const NAME_MAX = 40;

function lum(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}
// Text-safe pick for the grade badge: black or white, whichever reads better on the accent.
export const onAccent = (accent: string) => (contrast("#000000", accent) >= contrast("#ffffff", accent) ? "#000000" : "#ffffff");

export interface BrandCheck { ok: boolean; errors: string[]; brand: BrandTokens | null }
// Brand input is partner-supplied, so it is validated, never trusted: hex colours only (no CSS injection through a
// colour string), a plain-text name capped in length, and body text must reach WCAG AA (4.5:1) against the paper.
export function validateBrand(input: Partial<BrandTokens> | null | undefined): BrandCheck {
  const errors: string[] = [];
  const b = input ?? {};
  const name = typeof b.partnerName === "string" ? b.partnerName.trim() : "";
  if (!name) errors.push("partner_name_required");
  if (name.length > NAME_MAX) errors.push("partner_name_too_long");
  if (/[<>{}\\]|[\u0000-\u001f]/.test(name)) errors.push("partner_name_not_plain_text");
  for (const k of ["accent", "ink", "paper"] as const) if (typeof b[k] !== "string" || !HEX.test(b[k] as string)) errors.push(`${k}_must_be_hex`);
  const slot = b.logoSlot;
  if (!slot || !slot.label || !(slot.width >= 40 && slot.width <= 480) || !(slot.height >= 24 && slot.height <= 160)) errors.push("logo_slot_size_out_of_range");
  if (!errors.length && contrast(b.ink as string, b.paper as string) < 4.5) errors.push("ink_on_paper_below_aa");
  return errors.length ? { ok: false, errors, brand: null } : { ok: true, errors, brand: { partnerName: name, accent: b.accent!, ink: b.ink!, paper: b.paper!, logoSlot: slot! } };
}

// Brand tokens as CSS custom properties. Only called with a validated brand.
export function brandVars(b: BrandTokens): Record<string, string> {
  return { "--wl-accent": b.accent, "--wl-ink": b.ink, "--wl-paper": b.paper, "--wl-on-accent": onAccent(b.accent) };
}

export const SAMPLE_BRAND: BrandTokens = {
  partnerName: "Example Agency Pty Ltd",
  accent: "#1F6FEB", ink: "#14213D", paper: "#FFFFFF",
  logoSlot: { label: "Partner logo goes here", width: 160, height: 56 },
};

export const SAMPLE_DOMAIN = "client-sample.example";
// A planted DNS world with a realistic mix of faults: soft SPF, DMARC watching only, no DKIM, no DNSSEC.
const SAMPLE_WORLD: World = {
  txt: { [SAMPLE_DOMAIN]: ["v=spf1 include:_spf.google.com ~all"], [`_dmarc.${SAMPLE_DOMAIN}`]: ["v=DMARC1; p=none"] },
  mx: ["10 mx.client-sample.example."],
};

export interface SampleReport { synthetic: true; label: string; brand: BrandTokens; scan: ScanResult; plan: FixPlan; dateLabel: string }
export async function buildSampleReport(brand: BrandTokens = SAMPLE_BRAND): Promise<SampleReport> {
  const chk = validateBrand(brand);
  if (!chk.ok || !chk.brand) throw new Error("invalid_brand:" + chk.errors.join(","));
  const scan = await runScan(SAMPLE_DOMAIN, fakeDoh(SAMPLE_WORLD).fetch, () => 0);
  return {
    synthetic: true,
    label: "SYNTHETIC SAMPLE: invented domain and agency, no real client, not switched on",
    brand: chk.brand, scan, plan: buildPlan(scan), dateLabel: "Sample prepared 2026-11-08",
  };
}
