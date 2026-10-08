import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import HudStyle from "@/components/hud/HudStyle";
import EngineeringCounter from "@/components/hud/EngineeringCounter";
import Tachometer from "@/components/hud/Tachometer";
import ComputePanel from "@/components/hud/ComputePanel";
import ReceiptFeed from "@/components/hud/ReceiptFeed";
import { NUM, FEED } from "@/lib/hud/data";

const TITLE = "TITANOS HUD: live build statistics | TITANOS";
const DESC = "A live display of what we have built, how fast, and how little of our modelled ceiling we have used. Every number is labelled measured or modelled.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "https://titanos.tech/hud" },
  openGraph: { title: TITLE, description: DESC, type: "website", url: "https://titanos.tech/hud", images: [{ url: "/og-image.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/og-image.png"] },
  robots: { index: true, follow: true },
};

export default function HudPage() {
  return (
    <>
      <HudStyle />
      <PageHero
        badge="Live HUD"
        title="The build, as it happens."
        tagline="Engineering counted, compute gauged, every build receipted."
        sub="This is our own build, nothing of yours. Modelled figures are labelled modelled and are never revenue. Measured figures come straight from our own logs."
      />
      <div className="hud-wrap">
        <EngineeringCounter />
        <Tachometer />
        <ComputePanel />
        <div className="hud-wide">
          <ReceiptFeed />
        </div>
      </div>
      <p className="hud-stamp" style={{ padding: "20px 16px 56px", position: "relative", zIndex: 2 }}>
        Static page, updated at each build. Data snapshot {NUM.snapshot_ts.replace("T", " ")} AEST, feed generated {new Date(FEED.generated).toISOString().slice(0, 16).replace("T", " ")} UTC. The counter moves in your browser between builds.
      </p>
    </>
  );
}
