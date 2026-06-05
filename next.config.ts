import type { NextConfig } from "next";

// SEC-01 DEFENCE-IN-DEPTH NOTE
// ─────────────────────────────────────────────────────────────────────────────
// This project uses output: 'export' (static HTML export → GitHub Pages).
//
// Next.js `headers()` config ONLY applies to the Next.js development/SSR server
// or middleware-capable runtimes (Vercel Edge, Node server). It has NO effect on
// static exports served by GitHub Pages or any CDN that directly serves the
// generated `out/` directory.
//
// ENFORCEMENT POINT: Cloudflare Transform Rules are the SOLE layer that adds
// CSP, Permissions-Policy, Referrer-Policy, X-Frame-Options, and removes
// Access-Control-Allow-Origin from HTML responses.
//
// Do NOT add a `headers()` function here — it would be silently ignored during
// static export and mislead future maintainers into thinking headers are applied.
//
// See: audit/STAGED_CLOUDFLARE_RULES.md for the exact CF rules Kyle must apply.
// ─────────────────────────────────────────────────────────────────────────────

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: false,
};

export default nextConfig;
