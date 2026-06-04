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

export const metadata: Metadata = {
  metadataBase: new URL("https://titanos.tech"),
  title:
    "TITANOS — Three ways we help: Free Scan, Compliance, AI Implementation",
  description:
    "TITANOS helps Australian operators three ways: a free external attack-surface scan, AU Privacy Act + Essential Eight compliance (AU$5,997 + $199/mo), and full-cycle AI Implementation for Business. Powered by Claude Code. ABN 34 318 502 254.",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "192x192" }],
  },
  openGraph: {
    title: "TITANOS — Free Scan · Compliance · AI Implementation",
    description:
      "Three ways Titanos helps: free external attack-surface scan, Privacy Act + Essential Eight compliance, and AI Implementation for Business. Powered by Claude Code.",
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
      lang="en"
      className={`${cinzel.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body>
        <GoldDust />
        <VaultFrame playEntrance={true} />
        <CursorTrail />
        <Nav />
        <main style={{ position: "relative", zIndex: 2 }}>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
