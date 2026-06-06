import type { NextConfig } from "next";

// SEC-01 HEADERS — WHERE THEY LIVE
// ─────────────────────────────────────────────────────────────────────────────
// This project uses output: 'export' (static HTML export → GitHub Pages).
//
// Next.js `headers()` config has NO effect on static exports — GitHub Pages
// serves the generated `out/` directory as-is. Do NOT add a `headers()`
// function here; it would be silently ignored.
//
// Where each header is enforced:
//
//   Content-Security-Policy   →  app/layout.tsx <meta http-equiv> (repo-owned)
//   Referrer-Policy           →  CF Managed Transform + app/layout.tsx meta
//   X-Frame-Options           →  CF Managed Transform "Add security headers"
//   Strict-Transport-Security →  CF Managed Transform (already live)
//   X-Content-Type-Options    →  CF Managed Transform (already live)
//   Permissions-Policy        →  RESIDUAL — see audit/STAGED_CLOUDFLARE_RULES.md
//                                (meta tag is ignored by browsers per W3C spec)
//   Access-Control-Allow-Origin strip on HTML → RESIDUAL CF rule (SEC-02)
//
// CSP directives that don't work via meta (frame-ancestors, report-uri,
// sandbox) are either covered by sibling headers (XFO covers frame-ancestors)
// or intentionally omitted.
// ─────────────────────────────────────────────────────────────────────────────

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: false,
};

export default nextConfig;
