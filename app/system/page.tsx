import type { Metadata } from "next";
import PhiWordmark from "@/components/hero/PhiWordmark";
import VoidPortal from "@/components/hero/VoidPortal";
import GoldenSpiralField from "@/components/hero/GoldenSpiralField";
import { SPACE_PX, TYPE_PX, DUR } from "@/lib/phi";

export const metadata: Metadata = {
  title: "TITANOS design system",
  description: "Phi type scale, phi spacing, phi motion, the wordmark, the void portal and the golden spiral field.",
  robots: { index: false, follow: false },
};

export default function SystemPage() {
  return (
    <div style={{ background: "var(--ds-void)", color: "var(--ds-star)", paddingTop: "var(--phi-s8)" }}>
      <div className="container-vault" style={{ padding: "0 var(--phi-s4) var(--phi-s7)" }}>
        <PhiWordmark height={64} />
        <p style={{ color: "var(--ds-mist)", maxWidth: "38ch", margin: "var(--phi-s4) 0" }}>
          Every letter sits in a 1 by 1.618 golden rectangle. Crossbars sit at the golden section. The S is two stacked circles.
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--phi-t3)", fontWeight: 400, margin: "var(--phi-s6) 0" }}>
          Phi scale: {TYPE_PX.join(", ")} px
        </h1>
        <p style={{ color: "var(--ds-mist)" }}>Spacing {SPACE_PX.join(", ")} px. Motion {Object.values(DUR).join(", ")} s.</p>
      </div>
      <VoidPortal />
      <GoldenSpiralField />
    </div>
  );
}
