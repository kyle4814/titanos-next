import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import LoopOrbit from "@/components/charts/LoopOrbit";
import { Block, NumberBlock, NextStep } from "@/components/SiteBlocks";

export const metadata: Metadata = {
  title: "The learning loop · TITANOS",
  description: "Work, measure, find waste, turn the lesson into code, re-run, lower cost, do more work. Every turn leaves a receipt.",
  alternates: { canonical: "https://titanos.tech/learning-loop" },
  robots: { index: true, follow: true },
};

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
      <NumberBlock
        fact={{
          value: "251 jobs in 24 hours",
          label: "MEASURED",
          note: "Finished by our own worker fleet, 10 of them failed (4.0 percent). Counted from the job ledger on 8 October 2026. An upper bound on cost per job is published in the same file.",
          source: "state/baseline/BASELINE_2026-10-08.json",
        }}
      />
      <LoopOrbit />
      {STEPS.map(([a, b], i) => (
        <Block key={a} point={`${i + 1}. ${a}`}>{b}</Block>
      ))}
      <NextStep text="The same loop can run on your own repeat work." href="/ai-delivery" label="See how it applies to you" />
    </>
  );
}
