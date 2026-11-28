import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import { SPACE_IMAGES } from "@/lib/space-images";
import W2d from "@/components/w2d/W2d";
import Provenance from "@/components/Provenance";

const META_TITLE = "Image credits and licences | TITANOS";
const META_DESC =
  "Every space image on titanos.tech: title, source page, licence and the credit line required by NASA, ESA/Webb and ESA/Hubble.";

export const metadata: Metadata = withSeo("/credits", {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/credits" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/credits" },
  robots: { index: true, follow: true },
});


export default function Credits() {
  const n = SPACE_IMAGES.length;
  return (
    <W2d>
    <main>
      <PageHero
        badge="Credits"
        title="The universe is not ours. Here is whose it is."
        sub={`${n} real images from NASA, ESA/Webb and ESA/Hubble appear on this site. Each is listed here with its source, licence and the credit line its owner asks for.`}
      />
      <Provenance route="/credits" />
      <section className="pe-page pe-page--narrow pe-section">
        <div>
          <p className="pe-lead" style={{ margin: "0 0 18px", maxWidth: "none" }}>
            NASA images are used under the{" "}
            <a href="https://www.nasa.gov/nasa-brand-center/images-and-media/" rel="noopener">NASA media usage guidelines</a>{" "}
            (generally not copyrighted, no NASA endorsement implied). ESA/Webb and ESA/Hubble images are released under{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener">Creative Commons Attribution 4.0</a>{" "}
            and are credited in full below. Images are resized and re-encoded (AVIF and WebP) for speed; the colours and
            content are unchanged. Artist&apos;s concepts are labelled as illustrations.
          </p>
          <p className="pe-lead" style={{ margin: "0 0 18px", maxWidth: "none" }}>
            The gold T mountain artwork and the glass office render on the homepage are AI-generated images supplied by the owner. The office is an
            illustrative concept, not a real TITANOS building. The small T mark in the header is cropped from that render.
          </p>
          <ol style={{ listStyle: "none", padding: 0, margin: "32px 0 24px", display: "grid", gap: 12 }}>
            {SPACE_IMAGES.map((m) => (
              <li key={m.id} id={m.id} className="pe-card pe-card--pad" style={{ lineHeight: 1.65, scrollMarginTop: 96 }}>
                <b style={{ color: "var(--pe-gold-hi)" }}>{m.title}</b>
                <br />
                Credit: {m.credit}
                <br />
                Licence:{" "}
                <a href={m.licenceUrl} rel="noopener">{m.licence}</a>
                {" · "}
                Source: <a href={m.source} rel="noopener">{m.source}</a>
              </li>
            ))}
          </ol>
          <p className="pe-lead" style={{ margin: "0 0 18px", maxWidth: "none" }}>
            Spotted a wrong or missing credit? <a href="/contact">Tell us</a> and we will fix it the same day.
          </p>
        </div>
      </section>
    </main>
    </W2d>
  );
}
