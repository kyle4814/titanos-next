import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import VaultFrame from "@/components/VaultFrame";
import GoldDust from "@/components/GoldDust";
import CursorTrail from "@/components/CursorTrail";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

// SEO-03: description trimmed to 151 chars (≤155 limit)
const META_DESCRIPTION =
  "Free external security scan + AU Privacy Act compliance (AU$5,997 + $199/mo) + project-quoted AI implementation. Built for AU/NZ/SG operators.";

export const metadata: Metadata = {
  metadataBase: new URL("https://titanos.tech"),
  title:
    "TITANOS — Three ways we help: Free Scan, Compliance, AI Implementation",
  description: META_DESCRIPTION,
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "192x192" }],
  },
  openGraph: {
    title: "TITANOS — Free Scan · Compliance · AI Implementation",
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
      className={`${cinzel.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* SEO-06: Organisation JSON-LD on every page — page.tsx should drop its duplicate copy */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Titanos",
              url: "https://titanos.tech",
              logo: "https://titanos.tech/apple-touch-icon.png",
              description:
                "External attack-surface scanning + Privacy Act compliance + AI Implementation for AU/NZ/SG businesses.",
              areaServed: ["AU", "NZ", "SG"],
              identifier: {
                "@type": "PropertyValue",
                name: "ABN",
                value: "34318502254",
              },
              sameAs: ["https://cal.com/kyle-deligny-msvz6s/15min"],
            }),
          }}
        />
        {/* A11Y-04: skip-link — visually hidden until focused, bypasses 6 nav tab stops */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-black focus:text-[color:var(--gold)] focus:border focus:border-[color:var(--gold)] focus:rounded"
        >
          Skip to main content
        </a>
        <GoldDust />
        <VaultFrame playEntrance={true} />
        <CursorTrail />
        <Nav />
        <main id="main" style={{ position: "relative", zIndex: 2 }}>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
