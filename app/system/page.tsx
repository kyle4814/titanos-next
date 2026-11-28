import type { Metadata } from "next";
import PhiWordmark from "@/components/hero/PhiWordmark";
import GoldenSpiralField from "@/components/hero/GoldenSpiralField";
import { SPACE_PX, TYPE_PX, DUR } from "@/lib/phi";

export const metadata: Metadata = {
  title: "TITANOS design system",
  description: "Phi type scale, phi spacing, phi motion, the wordmark, the void portal and the golden spiral field.",
  robots: { index: false, follow: false },
};

export default function SystemPage() {
  return (
    <main className="pe-system" style={{ ["--ds-void" as string]: "var(--pe-bg)" }}>
      <div className="pe-page" style={{ paddingTop: "var(--pe-sp-7)", paddingBottom: "var(--pe-sp-7)" }}>
        <p className="pe-eyebrow-line">Design system</p>
        <PhiWordmark height={64} />
        <p className="pe-lead" style={{ maxWidth: "38ch", margin: "var(--pe-sp-5) 0" }}>
          Every letter sits in a 1 by 1.618 golden rectangle. Crossbars sit at the golden section. The S is two stacked circles.
        </p>
        <div className="pe-card pe-card--pad" style={{ maxWidth: 760 }}>
          <h1 style={{ fontSize: "var(--pe-fs-h1)", fontWeight: 700, margin: "0 0 var(--pe-sp-4)" }}>
            Phi scale: <span className="pe-goldtext">{TYPE_PX.join(", ")} px</span>
          </h1>
          <p className="pe-muted" style={{ margin: 0 }}>Spacing {SPACE_PX.join(", ")} px. Motion {Object.values(DUR).join(", ")} s.</p>
        </div>
      </div>
      <GoldenSpiralField />
    </main>
  );
}
