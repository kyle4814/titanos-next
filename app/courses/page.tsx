import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import AnimatedButton from "@/components/AnimatedButton";

export const metadata: Metadata = {
  title: "Courses · TITANOS",
  description: "Courses are not on sale yet. Here is what is true today and the free way to learn from us now.",
  alternates: { canonical: "https://titanos.tech/courses" },
  robots: { index: true, follow: true },
};

export default function CoursesPage() {
  return (
    <>
      <PageHero badge="COURSES" title="There are no courses on sale yet" tagline="We would rather tell you than sell you a placeholder." />
      <div className="pe-page">
        <SectionReveal className="pe-section">
          <p className="pe-eyebrow-line">What is true today</p>
          <div className="pe-grid pe-grid--2">
            <article className="pe-card pe-card--pad">
              <h2 style={{ fontSize: "var(--pe-fs-h3)", margin: "0 0 12px" }}>Today the best way to learn from us is free.</h2>
              <p className="pe-muted" style={{ margin: 0 }}>
                The blog and the free scan show the method on a real domain, which is the whole lesson.
              </p>
            </article>
            <article className="pe-card pe-card--pad">
              <h2 style={{ fontSize: "var(--pe-fs-h3)", margin: "0 0 12px" }}>
                When a course exists, it will say what it teaches, what it costs, and who it is for.
              </h2>
              <p className="pe-muted" style={{ margin: 0 }}>Until then this page stays honest and short.</p>
            </article>
          </div>
        </SectionReveal>
        <SectionReveal className="pe-section">
          <div className="pe-card pe-card--pad pe-card--gold" style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "var(--pe-fs-h2)", margin: "0 0 12px" }}>Read how we work, with receipts.</h2>
            <p className="pe-muted" style={{ margin: "0 0 20px" }}>Would it be okay if we showed you? A no is welcome.</p>
            <AnimatedButton href="/blog">Read the blog</AnimatedButton>
          </div>
        </SectionReveal>
      </div>
    </>
  );
}
