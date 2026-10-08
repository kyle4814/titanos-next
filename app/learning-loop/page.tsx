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
      <NumberBlock
        fact={{
          value: `${int("fleet_jobs_24h")} jobs in 24 hours`,
          label: "MEASURED",
          note: `Finished by our own worker fleet, ${dec("fleet_fail_rate_24h")} percent failed or stuck. Counted from the job ledger on ${AS_OF_LONG} (${dec("fleet_worker_hours_24h")} worker-hours, median job ${dec("fleet_median_job_min")} minutes).`,
          source: "Job ledger, via lib/ledger.json",
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
