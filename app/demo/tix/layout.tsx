import type { Metadata } from "next";
import type { CSSProperties } from "react";
import DemoBanner from "@/components/tix/DemoBanner";

export const metadata: Metadata = {
  title: "TIX-999 demo | TITANOS",
  description: "Interactive demo: rotating ticket QR, gate scanner and organiser panel.",
  robots: { index: false, follow: false },
};

const WRAP: CSSProperties = { maxWidth: 560, margin: "0 auto", padding: "110px 16px 60px", position: "relative", zIndex: 2, color: "var(--ice)" };

export default function TixLayout({ children }: { children: React.ReactNode }) {
  return (
    <main style={WRAP}>
      <DemoBanner />
      {children}
    </main>
  );
}
