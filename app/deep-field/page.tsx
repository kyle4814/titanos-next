import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import SpaceImage from "@/components/SpaceImage";
import { SPACE_IMAGES } from "@/lib/space-images";
import W2d from "@/components/w2d/W2d";
import Provenance from "@/components/Provenance";

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


export default function DeepField() {
  return (
    <W2d>
    <main>
      <PageHero
        badge="The deep field"
        title="Every number here is a point of light."
        sub="The universe is the oldest data set there is. These are real images, credited to the people who made them."
      />
      <Provenance route="/deep-field" />
      <section className="pe-page pe-section">
        <div className="pe-grid">
          {SPACE_IMAGES.map((m, i) => (
            <figure key={m.id} className="pe-card" style={{ margin: 0, overflow: "hidden" }}>
              <SpaceImage id={m.id} sizes="(max-width: 800px) 100vw, 340px" priority={i === 0} className="ds-deepfield__img" />
              <figcaption style={{ padding: "14px 18px 18px", color: "var(--pe-mute)", fontSize: 14, lineHeight: 1.6 }}>
                <b style={{ color: "var(--pe-text)" }}>{m.title}</b>
                <br />
                Credit: {m.credit}.{" "}
                <a href={`/credits#${m.id}`} className="pe-textlink">Licence and source</a>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
    </W2d>
  );
}
