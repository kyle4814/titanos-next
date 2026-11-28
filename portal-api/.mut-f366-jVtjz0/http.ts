// The ONE place a portal-api Response is built. json(), text(), empty() and withSecurityHeaders() always carry the
// five security headers; no other file may construct a Response directly (test/http_headers.test.ts scans for it).
// A caller-supplied value is never weakened: a longer HSTS max-age and a cache-control that already says no-store are kept.

export const HSTS_MAX_AGE = 31536000;
export const SECURITY_HEADERS = {
  "cache-control": "no-store",
  "strict-transport-security": `max-age=${HSTS_MAX_AGE}; includeSubDomains`,
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
} as const;

function hstsValue(existing: string | null): string {
  const m = existing ? /max-age\s*=\s*"?(\d+)"?/i.exec(existing) : null;
  const age = Math.max(HSTS_MAX_AGE, m ? Number(m[1]) : 0);
  const preload = existing && /(^|;)\s*preload\s*(;|$)/i.test(existing) ? "; preload" : "";
  return `max-age=${age}; includeSubDomains${preload}`;
}

// The literal values below are what scripts/headers_lint.mjs reads; test/http_headers.test.ts pins them to SECURITY_HEADERS.
function apply(res: Response): void {
  const cc = res.headers.get("cache-control");
  const hsts = hstsValue(res.headers.get("strict-transport-security"));
  if (!cc || !/\bno-store\b/i.test(cc)) res.headers.set("cache-control", "no-store");
  res.headers.set("strict-transport-security", hsts);
  res.headers.set("x-content-type-options", "nosniff");
  res.headers.set("referrer-policy", "no-referrer");
  res.headers.set("x-frame-options", "DENY");
}

// Idempotent. A Response with immutable headers (one that came from fetch) is rebuilt rather than mutated.
export function withSecurityHeaders(res: Response): Response {
  try { apply(res); return res; } catch { /* immutable headers */ }
  const copy = new Response(res.body, { status: res.status, statusText: res.statusText, headers: new Headers(res.headers) });
  apply(copy);
  return copy;
}

export function json(body: unknown, status = 200): Response {
  return withSecurityHeaders(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

export function text(body: string, type: string, extra: Record<string, string> = {}, status = 200): Response {
  return withSecurityHeaders(new Response(body, { status, headers: { "content-type": type, ...extra } }));
}

// Bodyless responses (204 preflight, 202 notification ack).
export function empty(status: number): Response {
  return withSecurityHeaders(new Response(null, { status }));
}
