import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import AnimatedButton from "@/components/AnimatedButton";
import s from "./sectors.module.css";
import { SECTORS } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "AI and Privacy Act Help by Industry | TITANOS",
  description: "Ten Australian sectors, one method: we read public records, grade what a stranger can see and hand back a plain list of changes. Start with your industry.",
  alternates: { canonical: "https://titanos.tech/sectors" },
  robots: { index: true, follow: true },
};

export default function SectorsPage() {
  return (
    <>
      <PageHero badge="SECTORS" title="Ten sectors, one method" tagline="We read public records about your business and tell you what a stranger could see." />
      <SectionReveal className="pe-section">
        <div className={`pe-page ${s.block}`}>
          <h2>Every sector page shows one number with its label, or says plainly that we have none yet.</h2>
          <p>Where a number is not measured, we write UNKNOWN and say what would measure it.</p>
        </div>
      </SectionReveal>
      <SectionReveal className="pe-section">
        <div className="pe-page">
          <ul className={s.list}>
            {SECTORS.map((x) => (
              <li key={x.slug}>
                <a href={`/sectors/${x.slug}`} className={`pe-card pe-card--pad pe-card--link ${s.card}`}>
                  <h3>{x.name}</h3>
                  <p>{x.point}</p>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </SectionReveal>
      <SectionReveal className="pe-section">
        <div className={`pe-page ${s.block}`}>
          <h2>The Sector Index is open data.</h2>
          <p>
            Every sector number above is in a file you can download, with its label and source. <a href="/open-data">Get the files</a>.
          </p>
        </div>
      </SectionReveal>
      <SectionReveal className="pe-section">
        <div className={`pe-page ${s.block}`}>
          <h2>Start with the free scan on your own domain.</h2>
          <p className={s.ask}>Would it be okay if we showed you? A no is welcome.</p>
          <AnimatedButton href="/scan">Run the free scan</AnimatedButton>
        </div>
      </SectionReveal>
    </>
  );
}
