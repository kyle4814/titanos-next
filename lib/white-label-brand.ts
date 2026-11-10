// C9 white-label reports engine (D8): pure brand-config validation + header/footer rendering.
// Synthetic-safe, no I/O, no network. Node 22 strips types, so keep to erasable TS syntax (no enums).

export type BrandInput = {
  name?: unknown;
  accent?: unknown;
  logoUrl?: unknown;
  footer?: unknown;
};

export type BrandOptions = {
  /** Report page background as #rgb or #rrggbb. Invalid or missing falls back to white. */
  background?: string;
  /** Hostnames a logo may come from (exact or subdomain). https only. */
  logoHosts?: readonly string[];
  /** Fallback accent. Must itself pass AA on the background. */
  defaultAccent?: string;
};

export type Brand = {
  name: string;
  accent: string;
  logoUrl: string | null;
  footer: string;
  background: string;
};

export type BrandResult = {
  ok: boolean;
  brand: Brand;
  /** null when the requested accent was used; otherwise why the default accent was used. */
  accentReason: string | null;
  issues: string[];
};

export const ATTRIBUTION = "Prepared with TITANOS";
export const ATTRIBUTION_URL = "https://titanos.tech";
export const DEFAULT_BACKGROUND = "#ffffff";
export const DEFAULT_ACCENT = "#0b5cad";
export const DEFAULT_LOGO_HOSTS: readonly string[] = ["cdn.titanos.tech", "assets.titanos.tech"];
export const AA_NORMAL = 4.5;
export const NAME_MAX = 60;
export const FOOTER_MAX = 200;
export const FALLBACK_NAME = "Partner report";

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const IMG_EXT_RE = /\.(?:png|jpe?g|webp|svg)$/i;

function parseHex(hex: string): [number, number, number] | null {
  if (!HEX_RE.test(hex)) return null;
  let h = hex.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function normHex(hex: string): string {
  const p = parseHex(hex);
  if (!p) return "";
  return "#" + p.map((n) => n.toString(16).padStart(2, "0")).join("");
}

function lin(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const p = parseHex(hex);
  if (!p) throw new Error("bad hex");
  return 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
}

/** WCAG 2.x contrast ratio, 1..21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Remove all markup and control characters; text is escaped again at render time. */
export function stripMarkup(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  let s = v;
  // Decode nothing: just remove tags to a fixpoint, then any stray angle bracket.
  for (let i = 0; i < 10; i++) {
    const next = s.replace(/<[^>]*>/g, "").replace(/<[^>]*$/g, "");
    if (next === s) break;
    s = next;
  }
  s = s.replace(/[<>]/g, "");
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x1f\x7f-\x9f]/g, " ").replace(new RegExp("[\\u2028\\u2029]", "g"), " ");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > max) s = s.slice(0, max).trim();
  return s;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** https only, allowlisted host, no credentials/port/query/fragment, image extension. Returns href or null. */
export function checkLogoUrl(v: unknown, hosts: readonly string[]): { url: string | null; reason: string | null } {
  if (v === undefined || v === null || v === "") return { url: null, reason: null };
  if (typeof v !== "string") return { url: null, reason: "logo_not_string" };
  if (v.length > 500) return { url: null, reason: "logo_too_long" };
  if (/[\s"'<>\\`]/.test(v)) return { url: null, reason: "logo_bad_chars" };
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return { url: null, reason: "logo_unparseable" };
  }
  if (u.protocol !== "https:") return { url: null, reason: "logo_not_https" };
  if (u.username || u.password) return { url: null, reason: "logo_credentials" };
  if (u.port) return { url: null, reason: "logo_port" };
  if (u.search || u.hash) return { url: null, reason: "logo_query_or_fragment" };
  const host = u.hostname.toLowerCase();
  const allowed = hosts.some((h) => {
    const a = h.toLowerCase();
    return host === a || host.endsWith("." + a);
  });
  if (!allowed) return { url: null, reason: "logo_host_not_allowlisted" };
  if (!IMG_EXT_RE.test(u.pathname)) return { url: null, reason: "logo_not_image" };
  return { url: u.href, reason: null };
}

export function validateBrand(input: BrandInput | null | undefined, opts: BrandOptions = {}): BrandResult {
  const issues: string[] = [];
  const i = input && typeof input === "object" ? input : {};

  let background = DEFAULT_BACKGROUND;
  if (opts.background !== undefined) {
    if (typeof opts.background === "string" && HEX_RE.test(opts.background)) background = normHex(opts.background);
    else issues.push("background_invalid_using_white");
  }

  let fallback = normHex(opts.defaultAccent ?? DEFAULT_ACCENT);
  if (!fallback || contrastRatio(fallback, background) < AA_NORMAL) {
    // The fallback itself must be safe: black or white, whichever reads on the background.
    fallback = contrastRatio("#000000", background) >= contrastRatio("#ffffff", background) ? "#000000" : "#ffffff";
  }

  const name = stripMarkup(i.name, NAME_MAX);
  if (!name) issues.push("name_required");
  const footer = stripMarkup(i.footer, FOOTER_MAX);

  let accent = fallback;
  let accentReason: string | null = null;
  if (i.accent === undefined || i.accent === null || i.accent === "") {
    accentReason = "accent_missing";
  } else if (typeof i.accent !== "string" || !HEX_RE.test(i.accent.trim())) {
    accentReason = "accent_invalid_format";
  } else {
    const want = normHex(i.accent.trim());
    const ratio = contrastRatio(want, background);
    if (ratio >= AA_NORMAL) accent = want;
    else accentReason = `accent_low_contrast:${ratio.toFixed(2)}<${AA_NORMAL}`;
  }

  const logo = checkLogoUrl(i.logoUrl, opts.logoHosts ?? DEFAULT_LOGO_HOSTS);
  if (logo.reason) issues.push(logo.reason);

  return {
    ok: name !== "",
    brand: { name: name || FALLBACK_NAME, accent, logoUrl: logo.url, footer, background },
    accentReason,
    issues,
  };
}

/** Things a rendered report must never contain. Returns the matches (empty = clean). */
export function findForbidden(html: string): string[] {
  const found: string[] = [];
  const checks: [string, RegExp][] = [
    ["script", /<script/i],
    ["iframe", /<(?:iframe|object|embed)/i],
    ["link", /<(?:link|meta|base|style)/i],
    ["event_handler", /\son[a-z]+\s*=/i],
    ["js_url", /javascript:/i],
    ["tiny_pixel", /(?:width|height)\s*=\s*["']?[01](?!\d)/i],
    ["css_url", /url\s*\(/i],
    ["second_img", /<img[\s\S]*<img/i],
  ];
  for (const [k, re] of checks) if (re.test(html)) found.push(k);
  return found;
}

const FONT = "font-family:Helvetica,Arial,sans-serif";

export function renderHeaderHtml(b: Brand): string {
  const logo = b.logoUrl
    ? `<img src="${escapeHtml(b.logoUrl)}" alt="${escapeHtml(b.name)} logo" height="40" style="height:40px;width:auto;vertical-align:middle;margin-right:12px">`
    : "";
  return (
    `<header style="${FONT};background:${b.background};padding:16px 0;border-bottom:3px solid ${b.accent}">` +
    logo +
    `<span style="color:${b.accent};font-size:22px;font-weight:700;vertical-align:middle">${escapeHtml(b.name)}</span>` +
    `</header>`
  );
}

export function renderFooterHtml(b: Brand): string {
  const own = b.footer ? `<p style="margin:0 0 6px 0;color:#1a1a1a">${escapeHtml(b.footer)}</p>` : "";
  return (
    `<footer style="${FONT};background:${b.background};padding:12px 0;border-top:1px solid ${b.accent};font-size:13px">` +
    own +
    `<p style="margin:0;color:#1a1a1a">${ATTRIBUTION} (<a href="${ATTRIBUTION_URL}" style="color:${b.accent}">titanos.tech</a>)</p>` +
    `</footer>`
  );
}

export function renderHeaderText(b: Brand): string {
  return `${b.name}\n${"=".repeat(Math.min(b.name.length, 60))}`;
}

export function renderFooterText(b: Brand): string {
  const lines = ["--"];
  if (b.footer) lines.push(b.footer);
  lines.push(`${ATTRIBUTION} (titanos.tech)`);
  return lines.join("\n");
}

export type Rendered = { html: { header: string; footer: string }; text: { header: string; footer: string } };

/** Validate then render. Never throws on bad partner input; the result carries the reasons. */
export function renderBrandedFrame(input: BrandInput | null | undefined, opts: BrandOptions = {}): Rendered & BrandResult {
  const r = validateBrand(input, opts);
  let header = renderHeaderHtml(r.brand);
  let footer = renderFooterHtml(r.brand);
  if (findForbidden(header + footer).length) {
    // Defence in depth: drop the logo and re-render rather than ship anything forbidden.
    const safe: Brand = { ...r.brand, logoUrl: null };
    header = renderHeaderHtml(safe);
    footer = renderFooterHtml(safe);
    r.issues.push("render_guard_dropped_logo");
  }
  return { ...r, html: { header, footer }, text: { header: renderHeaderText(r.brand), footer: renderFooterText(r.brand) } };
}
