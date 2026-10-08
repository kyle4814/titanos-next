import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import { Block, NextStep } from "@/components/SiteBlocks";
import { COURSES, allLessons, coursePriceAud, totalMinutes } from "@/lib/courses";
import { formatAUD } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Courses · TITANOS",
  description: "Written courses on email security, getting your hours back with AI, and public-records due diligence. Text only, AI use disclosed, first lesson free.",
  alternates: { canonical: "https://titanos.tech/courses" },
  robots: { index: true, follow: true },
};

export default function CoursesPage() {
  return (
    <>
      <PageHero badge="COURSES" title="Three written courses, first lesson free" tagline="Plain English, your own domain and your own numbers, no video and no jargon." />
      <Block point="Every course says who it is for, what it teaches and what it costs.">
        Each one is written by TITANOS with AI assistance, and says so on every page. They are text only, with worksheets, a quiz and a completion certificate. You can read the outline and the first lesson of each before you decide.
      </Block>
      <SectionReveal style={{ padding: "var(--space-8) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault" style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          {COURSES.map((c) => {
            const price = coursePriceAud(c);
            return (
              <article key={c.slug} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "24px 26px", marginBottom: 22 }}>
                <h2 style={{ fontFamily: "var(--font-display), Georgia, serif", color: "var(--gold)", fontSize: "var(--fs-h3)" }}>
                  <Link href={`/courses/${c.slug}`} style={{ color: "inherit" }}>{c.title}</Link>
                </h2>
                <p style={{ color: "var(--text)", lineHeight: 1.7, margin: "10px 0" }}>{c.tagline}</p>
                <p className="label-system" style={{ color: "var(--ice)" }}>
                  {c.modules.length} MODULES · {allLessons(c).length} LESSONS · ABOUT {Math.round(totalMinutes(c) / 60)} HOURS · {price === null ? "PRICE TO BE CONFIRMED" : `${formatAUD(price)} ONE-OFF`}
                </p>
              </article>
            );
          })}
        </div>
      </SectionReveal>
      <NextStep text="Not sure which one fits? Start with the free scan and we will point you to it." href="/scan" label="Run the free scan" />
    </>
  );
}
