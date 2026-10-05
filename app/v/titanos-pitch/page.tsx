import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { STATS } from "@/lib/stats";

// Unlisted founder pitch page (Kyle 2026-10-05): shared by direct link with accelerators and investors.
// Not in the nav, footer or sitemap; noindex here and Disallow: /v/ in robots.txt.
export const metadata: Metadata = {
  title: "TITANOS: founder pitch, Kyle Deligny",
  description: "A 70-second founder pitch for TITANOS, with the key facts, links and contact details.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://titanos.tech/v/titanos-pitch" },
};

const FACTS: { k: string; v: string }[] = [
  { k: "What it is", v: "TITANOS turns public records into new work, protection and compliance for small businesses, sold as simple products they can buy online." },
  { k: "Live today", v: "titanos.tech with published prices, 103 productised offers and online checkout on 30 of them, plus an offline guide that matches each visitor to the right offer." },
  { k: "How it works", v: "It reads live government contract awards, company registers and public DNS every day, writes sourced and dated reports, and runs AI agents with a human approving anything that goes out." },
  { k: "Built", v: "Solo, since 24 August 2026: 152,293 lines of tested Python and 5,760 automated tests in the main repository, about 39 engineer-years of work by the Basic COCOMO estimate, on about US$30 a month of AI tools." },
  { k: "Reach so far", v: `${STATS.scansLast30Days.toLocaleString("en-AU")} business domains checked in the last 30 days and ${STATS.organisationsResearched.toLocaleString("en-AU")} organisations researched in full dossiers (counted from our records on ${STATS.asOf}).` },
  { k: "Founder", v: "Kyle Deligny, Brisbane. Sold $77k of solar in three months before teaching himself to build TITANOS." },
  { k: "Status", v: "Pre-revenue, raising a pre-seed round. Sole trader today (ABN 34 318 502 254); a company is incorporated before any investment closes." },
];

export default function PitchPage() {
  return (
    <>
      <PageHero
        badge="TITANOS · FOUNDER PITCH"
        title="TITANOS in 70 seconds."
        tagline="Kyle Deligny, founder. Public records in, new work and protection out, for small businesses."
        sub="Thanks for taking a look. The key facts and links are under the video."
      />
      <section className="container-vault" style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px 48px" }}>
        <video
          controls
          playsInline
          preload="metadata"
          poster="/v/titanos-pitch-poster.jpg"
          style={{ width: "100%", borderRadius: "var(--radius-md)", border: "1px solid var(--gold-dim)", background: "#000" }}
        >
          <source src="/v/titanos-pitch.mp4" type="video/mp4" />
          Your browser cannot play this video. <a href="/v/titanos-pitch.mp4">Download it here</a>.
        </video>

        <div style={{ marginTop: 32, display: "grid", gap: 14 }}>
          {FACTS.map((f) => (
            <div key={f.k} style={{ background: "var(--card)", border: "1px solid var(--gold-dim)", borderRadius: "var(--radius-md)", padding: "14px 18px" }}>
              <div style={{ color: "var(--gold)", fontWeight: 700, marginBottom: 4 }}>{f.k}</div>
              <div style={{ color: "var(--text)", lineHeight: 1.65 }}>{f.v}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link className="btn" href="/offers">See every offer</Link>
          <Link className="btn" href="/find">Try the offer finder</Link>
          <a className="btn" href="/d/titanos-deck-2026-10.pdf">Investor deck (PDF)</a>
          <Link className="btn" href="/engineering">How it was built</Link>
        </div>
        <p style={{ marginTop: 24, color: "var(--dim)" }}>
          Contact: Kyle Deligny · <a href="mailto:kyle@titanos.tech" style={{ color: "var(--gold)" }}>kyle@titanos.tech</a> · titanos.tech
        </p>
      </section>
    </>
  );
}
