import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { withSeo } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import SpaceImage from "@/components/SpaceImage";
import { SPACE_IMAGES } from "@/lib/space-images";

const META_TITLE = "The deep field: real images of the universe | TITANOS";
const META_DESC =
  "Black holes, nebulae, star fields and galaxies from NASA, ESA/Webb and ESA/Hubble. The same braid of light we build with: loose strands, a knot, a network.";

export const metadata: Metadata = withSeo("/deep-field", {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/deep-field" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/deep-field" },
  robots: { index: true, follow: true },
});

const SECTION: CSSProperties = { padding: "var(--space-12) 20px", position: "relative", zIndex: 2 };
const GRID: CSSProperties = {
  maxWidth: 1240, margin: "0 auto", display: "grid", gap: 20,
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
};
const FIG: CSSProperties = { margin: 0, background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" };
const CAP: CSSProperties = { padding: "10px 14px 14px", color: "var(--ice)", fontSize: 14, lineHeight: 1.55 };

export default function DeepField() {
  return (
    <main>
      <PageHero
        badge="The deep field"
        title="Every number here is a point of light."
        sub="The universe is the oldest data set there is. These are real images, credited to the people who made them."
      />
      <section style={SECTION}>
        <div style={GRID}>
          {SPACE_IMAGES.map((m, i) => (
            <figure key={m.id} style={FIG}>
              <SpaceImage id={m.id} sizes="(max-width: 800px) 100vw, 340px" priority={i === 0} className="ds-deepfield__img" />
              <figcaption style={CAP}>
                <b style={{ color: "var(--gold)" }}>{m.title}</b>
                <br />
                Credit: {m.credit}.{" "}
                <a href={`/credits#${m.id}`} style={{ color: "var(--gold)" }}>Licence and source</a>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}
