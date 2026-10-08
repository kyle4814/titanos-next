import type { Metadata } from "next";
import type { CSSProperties } from "react";
import PageHero from "@/components/PageHero";
import { SPACE_IMAGES } from "@/lib/space-images";

const META_TITLE = "Image credits and licences | TITANOS";
const META_DESC =
  "Every space image on titanos.tech: title, source page, licence and the credit line required by NASA, ESA/Webb and ESA/Hubble.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/credits" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/credits" },
  robots: { index: true, follow: true },
};

const SECTION: CSSProperties = { padding: "var(--space-12) 20px", position: "relative", zIndex: 2 };
const WRAP: CSSProperties = { maxWidth: 980, margin: "0 auto" };
const BODY: CSSProperties = { color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "0 0 14px" };
const A: CSSProperties = { color: "var(--gold)" };
const ROW: CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
  padding: "14px 18px", margin: "0 0 12px", color: "var(--ice)", lineHeight: 1.6,
};

export default function Credits() {
  const n = SPACE_IMAGES.length;
  return (
    <main>
      <PageHero
        badge="Credits"
        title="The universe is not ours. Here is whose it is."
        sub={`${n} real images from NASA, ESA/Webb and ESA/Hubble appear on this site. Each is listed here with its source, licence and the credit line its owner asks for.`}
      />
      <section style={SECTION}>
        <div style={WRAP}>
          <p style={BODY}>
            NASA images are used under the{" "}
            <a style={A} href="https://www.nasa.gov/nasa-brand-center/images-and-media/" rel="noopener">NASA media usage guidelines</a>{" "}
            (generally not copyrighted, no NASA endorsement implied). ESA/Webb and ESA/Hubble images are released under{" "}
            <a style={A} href="https://creativecommons.org/licenses/by/4.0/" rel="noopener">Creative Commons Attribution 4.0</a>{" "}
            and are credited in full below. Images are resized and re-encoded (AVIF and WebP) for speed; the colours and
            content are unchanged. Artist&apos;s concepts are labelled as illustrations.
          </p>
          <ol style={{ listStyle: "none", padding: 0, margin: "24px 0 0" }}>
            {SPACE_IMAGES.map((m) => (
              <li key={m.id} id={m.id} style={ROW}>
                <b style={{ color: "var(--gold)" }}>{m.title}</b>
                <br />
                Credit: {m.credit}
                <br />
                Licence:{" "}
                <a style={A} href={m.licenceUrl} rel="noopener">{m.licence}</a>
                {" · "}
                Source: <a style={A} href={m.source} rel="noopener">{m.source}</a>
              </li>
            ))}
          </ol>
          <p style={BODY}>
            Spotted a wrong or missing credit? <a style={A} href="/contact">Tell us</a> and we will fix it the same day.
          </p>
        </div>
      </section>
    </main>
  );
}
