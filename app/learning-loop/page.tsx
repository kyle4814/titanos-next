import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import LoopOrbit from "@/components/charts/LoopOrbit";
import SectionReveal from "@/components/SectionReveal";
import AnimatedButton from "@/components/AnimatedButton";
import Provenance from "@/components/Provenance";

export const metadata: Metadata = withSeo("/learning-loop", {
  title: "The learning loop · TITANOS",
  description: "Work, measure, find waste, turn the lesson into code, re-run, lower cost, do more work. Every turn leaves a receipt.",
  alternates: { canonical: "https://titanos.tech/learning-loop" },
  robots: { index: true, follow: true },
});

import { int, dec, AS_OF_LONG } from "@/lib/ledger";
const STEPS = [
  ["Work", "A job runs and leaves a record."],
  ["Measure", "We count what it cost and how long it took."],
  ["Find waste", "We look for the part that did not need to happen."],
  ["Turn the lesson into code", "A fix becomes a test so the mistake cannot return quietly."],
  ["Re-run", "The same job runs again on the improved system."],
  ["Lower the cost", "The new cost is measured against the old one."],
  ["More work", "The saving buys more jobs, and the loop turns again."],
];

export default function LearningLoopPage() {
  return (
    <>
      <PageHero badge="THE LEARNING LOOP" title="We did not buy a bigger machine, we changed the system" tagline="Seven steps, and every turn leaves a receipt." />
      <div className="pe-page">
        <Provenance route="/learning-loop" />
        <SectionReveal className="pe-section">
          <article className="pe-card pe-card--pad pe-card--gold">
            <p className="pe-eyebrow-line">The biggest true number</p>
            <p className="pe-goldtext" style={{ fontSize: "var(--pe-fs-h1)", fontWeight: 700, lineHeight: 1.1, margin: "0 0 8px" }}>
              {`${int("fleet_jobs_24h")} jobs in 24 hours`}
            </p>
            <p data-claim-label="MEASURED" className="pe-kicker" style={{ margin: "0 0 12px" }}>MEASURED</p>
            <p className="pe-muted" style={{ margin: 0, maxWidth: "68ch" }}>
              {`Finished by our own worker fleet, ${dec("fleet_fail_rate_24h")} percent failed or stuck. Counted from the job ledger on ${AS_OF_LONG} (${dec("fleet_worker_hours_24h")} worker-hours, median job ${dec("fleet_median_job_min")} minutes).`}
            </p>
            <p style={{ fontSize: "var(--pe-fs-sm)", color: "var(--pe-faint)", margin: "10px 0 0" }}>Source: Job ledger, via lib/ledger.json</p>
          </article>
        </SectionReveal>
      </div>
      <LoopOrbit />
      <div className="pe-page">
        <SectionReveal className="pe-section">
          <p className="pe-eyebrow-line">The seven steps</p>
          <ol className="pe-grid" role="group" aria-label="The seven steps" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {STEPS.map(([a, b], i) => (
              <li key={a} className="pe-card pe-card--pad">
                <span className="pe-kicker" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <h2 style={{ fontSize: "var(--pe-fs-h3)", margin: "8px 0 8px" }}>{`${i + 1}. ${a}`}</h2>
                <p className="pe-muted" style={{ margin: 0 }}>{b}</p>
              </li>
            ))}
          </ol>
        </SectionReveal>
        <SectionReveal className="pe-section">
          <div className="pe-grid pe-grid--2">
            <div className="pe-card pe-card--pad pe-card--gold">
              <h2 style={{ fontSize: "var(--pe-fs-h3)", margin: "0 0 10px" }}>The same loop can run on your own repeat work.</h2>
              <p className="pe-muted" style={{ margin: "0 0 18px" }}>Would it be okay if we showed you? A no is welcome.</p>
              <AnimatedButton href="/ai-delivery">See how it applies to you</AnimatedButton>
            </div>
            <div className="pe-card pe-card--pad">
              <h2 style={{ fontSize: "var(--pe-fs-h3)", margin: "0 0 10px" }}>Find where your own week is going, free, in your browser.</h2>
              <p className="pe-muted" style={{ margin: "0 0 18px" }}>Would it be okay if we showed you? A no is welcome.</p>
              <AnimatedButton href="/x-ray">Try the free X-Ray</AnimatedButton>
            </div>
          </div>
        </SectionReveal>
      </div>
    </>
  );
}
