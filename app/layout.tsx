import { SigilConstellation } from "../components/Sigil";
import EasterEgg from "@/components/EasterEgg";
import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import "./design-system.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import VaultFrame from "@/components/VaultFrame";
import VaultBackground from "@/components/VaultBackground";
import DeferredShell from "@/components/DeferredShell";
import MotionProvider from "@/components/MotionProvider";
import PageMood from "@/components/PageMood";
import StickyMobileCta from "@/components/StickyMobileCta";
import SiteAnalytics from "@/components/SiteAnalytics";
import JsonLd from "@/components/JsonLd";
import { organization, website } from "@/lib/jsonld";

// SEC-01 — Content-Security-Policy via meta http-equiv (repo-owned).
//
// Static-export + GitHub Pages cannot serve custom response headers from
// the repo (no _headers support; next.config headers() is no-op under
// output:'export'). Meta tags are the only repo-level enforcement layer
// that browsers actually honour.
//
// Directive coverage notes:
//   - frame-ancestors is IGNORED in meta CSP (W3C spec). Clickjacking
//     protection is enforced by Cloudflare's managed X-Frame-Options:
//     SAMEORIGIN header (CF Managed Transform "Add security headers").
//   - 'unsafe-inline' on script-src / style-src is required because
//     Next 16 static export injects inline <script> + <style> blocks.
//   - Cloudflare's own injected scripts (Bot Management, email-decode,
//     Insights beacon) are served from the site's own origin under
//     /cdn-cgi/, so 'self' already covers them.
//     A bare path like "/cdn-cgi/scripts/" is NOT a valid CSP source
//     expression — browsers reject the whole token and log
//     "contains an invalid source". It was doing nothing except emitting
//     a console error on every page load (confirmed 2026-08-20 in a real
//     browser), so it's removed rather than "fixed": 'self' is the
//     correct and sufficient source here.
const CSP =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; " +
  "font-src 'self'; " +
  // connect-src includes api.titanos.tech so the /scan-request form
  // can POST cross-origin, and vault.titanos.tech for the site-event
  // analytics beacon (SiteAnalytics.tsx — write-only, no cookies).
  // fetch() is governed by connect-src; the legacy form-action
  // 'mailto:' directive below covers the noscript mailto fallback only.
  "connect-src 'self' https://api.titanos.tech https://vault.titanos.tech https://cloudflareinsights.com; " +
  // frame-src allows the vault.titanos.tech partner-signup embed only.
  "frame-src 'self' https://vault.titanos.tech; " +
  "base-uri 'self'; " +
  "form-action 'self' mailto:";

// W4 PILLAR 1 — typography swap.
//
// Cinzel was the AI-default "luxury display" font of 2024-2026. Buyers'
// pattern-match for "AI site" was triggered by it. Replaced with:
//
//   Display (wordmark, hero, H1/H2): IBM Plex Serif at weight 300 italic
//     + 400 + 700. Editorial-luxury, distinctive, free.
//   Body (paragraphs, UI): Inter Tight. Subtly tighter than Inter; reads
//     "considered modern" without being the safe default.
//   Mono (eyebrow labels, terminal, technical microcopy): IBM Plex Mono.
//     Operator vocabulary. Used in small doses across every page.
// W1 (2026-10-08): two self-hosted licensed variable fonts, SIL OFL 1.1 (see public/fonts/OFL-*.txt, docs/W1_LICENCES.md).
//   Display: Fraunces (variable wght, latin subset), headlines on the phi type scale.
//   Body: Geist (variable wght, latin subset), a clean grotesk.
const fraunces = localFont({
  variable: "--font-display",
  src: [
    { path: "../public/fonts/fraunces-wght.woff2", style: "normal", weight: "100 900" },
    { path: "../public/fonts/fraunces-wght-italic.woff2", style: "italic", weight: "100 900" },
  ],
  display: "swap",
  preload: true,
  adjustFontFallback: "Times New Roman",
  fallback: ["Georgia", "serif"],
});

const geist = localFont({
  variable: "--font-body",
  src: [{ path: "../public/fonts/geist-wght.woff2", style: "normal", weight: "100 900" }],
  display: "swap",
  preload: true,
  adjustFontFallback: "Arial",
  fallback: ["system-ui", "sans-serif"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  preload: false,
  fallback: ["monospace"],
});

// SEO-03: description trimmed under 155 chars
const META_TITLE = "Titanos: AI systems that grow your business, privacy-compliant by design";
const META_DESCRIPTION =
  "I build AI systems that automate the manual work eating your week, privacy-compliant by design. Free AI audit call. Brisbane, Australia.";

export const metadata: Metadata = {
  metadataBase: new URL("https://titanos.tech"),
  title: META_TITLE,
  description: META_DESCRIPTION,
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "192x192" }],
  },
  openGraph: {
    title: META_TITLE,
    description: META_DESCRIPTION,
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.png"],
  },
  alternates: { canonical: "https://titanos.tech/" },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The home page is the only route that should play the entrance choreography
  // on first session visit; VaultFrame reads sessionStorage and decides itself.
  return (
    <html
      lang="en-AU"
      className={`${fraunces.variable} ${geist.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* SEC-01 — CSP meta hoisted into <head>. React 19 hoists from
            anywhere, but explicit placement keeps intent obvious. */}
        <meta httpEquiv="Content-Security-Policy" content={CSP} />
        {/* Referrer-Policy belt-and-braces: CF Managed sets it server-side
            (same-origin), this meta tag is a no-op when the header is
            present but lights up if CF Managed is ever disabled. */}
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body>
        {/*
          ▄▄▄█████▓ ██▓▄▄▄█████▓ ▄▄▄       ███▄    █  ▒█████    ██████
          ▓  ██▒ ▓▒▓██▒▓  ██▒ ▓▒▒████▄     ██ ▀█   █ ▒██▒  ██▒▒██    ▒
          ▒ ▓██░ ▒░▒██▒▒ ▓██░ ▒░▒██  ▀█▄  ▓██  ▀█ ██▒▒██░  ██▒░ ▓██▄
          ░ ▓██▓ ░ ░██░░ ▓██▓ ░ ░██▄▄▄▄██ ▓██▒  ▐▌██▒▒██   ██░  ▒   ██▒
            ▒██▒ ░ ░██░  ▒██▒ ░  ▓█   ▓██▒▒██░   ▓██░░ ████▓▒░▒██████▒▒

          Kyle Deligny · kyle@titanos.tech · ABN 34 318 502 254
          Built with Claude Code. Reading this means you're already curious.
          Email if you want to talk.
        */}
        {/* SEO-06: Organisation JSON-LD on every page — page.tsx should drop its duplicate copy */}
        <JsonLd data={organization()} />
        <JsonLd data={website()} />
        {/* A11Y-04: skip-link — visually hidden until focused, bypasses 6 nav tab stops */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-black focus:text-[color:var(--gold)] focus:border focus:border-[color:var(--gold)] focus:rounded"
        >
          Skip to main content
        </a>
        {/* W4 Pillar 3 — layered background system (warm canvas + grain +
            lattice via globals.css ::before/::after; mesh + specular sweep
            via VaultBackground). VaultBackground also handles tab-hidden
            pause for battery / politeness. */}
        <MotionProvider>
        <VaultBackground />
        {/* Ambient gold dust — built in the Vault rebuild but never
            mounted; wired in 2026-07-11 (canvas colour bug fixed same
            day). 30 particles, fixed layer, reduced-motion bails. */}
        <VaultFrame playEntrance={true} />
        {/* W4 Pillar 5 — gold edge thread (always-visible left edge) */}
        <span aria-hidden="true" className="vault-edge-thread" />
        {/* W4 per-page mood swap */}
        <PageMood />
        <SigilConstellation />
        <EasterEgg />
        <SiteAnalytics />
        <Nav />
        <main id="main" style={{ position: "relative", zIndex: 2 }}>
          {children}
        </main>
        <Footer />
        <StickyMobileCta />
        <DeferredShell />
        </MotionProvider>
      </body>
    </html>
  );
}
