import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import SectionReveal from "@/components/SectionReveal";
import PageHero from "@/components/PageHero";
import XrayWizard from "@/components/XrayWizard";
import "../black-ice/bi.css";

const baseMetadata: Metadata = {
  title: "Free Workflow X-Ray: find the bottleneck costing you time · TITANOS",
  description:
    "Answer a few questions about one recurring task. Get a free bottleneck check, practical fixes and a time estimate you can inspect. No login, no software access, nothing sent.",
  alternates: { canonical: "https://titanos.tech/x-ray" },
  robots: { index: true, follow: true },
};

export const metadata: Metadata = withSeo("/x-ray", baseMetadata);

export default function XrayPage() {
  return (
    <>
      <PageHero
        badge="FREE WORKFLOW X-RAY"
        title="Find the bottleneck costing your business time"
        tagline="Answer a few questions about one recurring task. You get a free bottleneck check, practical fixes and an improvement estimate you can inspect."
        sub="No account or system access needed to start. It runs in this page, on your device."
      />

      <SectionReveal style={{ padding: "var(--space-12) 20px 0", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <h2 className="bi-h2">THREE PROMISES BEFORE YOU START</h2>
          <ul className="bi-list">
            <li>No login. You do not give an email address to see the result or download the report.</li>
            <li>No software connection and no uploads. You describe the task in your own words and numbers.</li>
            <li>The advice is yours to use whether or not you ever talk to us. Doing nothing is an allowed answer.</li>
          </ul>
        </div>
      </SectionReveal>

      <SectionReveal style={{ padding: "var(--space-8) 20px var(--space-12)", position: "relative", zIndex: 2 }}>
        <XrayWizard />
      </SectionReveal>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-12) 20px var(--space-16)", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <h2 className="bi-h2">WHAT THE ESTIMATE IS, AND IS NOT</h2>
          <p className="bi-p">
            The hours are a scenario built from your own answers and a short list of labelled assumptions: how much of the
            hands-on time a tool could take off the task, how many people would really use it, and the upkeep it needs. Low,
            base and high are bands, not statistical ranges. Capacity freed is not cash saved, and waiting time is shown
            beside the hours, never added to them. If your answers are too thin, the X-Ray says so and gives you a small
            measuring exercise instead of a number.
          </p>
          <p className="bi-p">
            It looks at the work, never at the people doing it. Nobody is assessed and nobody is replaced.
          </p>

          <h2 className="bi-h2" style={{ marginTop: 40 }}>WHAT THIS IS NOT</h2>
          <p className="bi-p">
            This is a questionnaire. It does not read your documents, connect to your software, measure a pilot, or scan
            your website or network. Those are separate things, each with its own consent, and none of them is part of this
            free check. If you want a public email security check on your domain, that is the{" "}
            <a href="/scan">free scan</a>, which is a different tool.
          </p>

          <h2 className="bi-h2" style={{ marginTop: 40 }}>IF YOU WANT TO GO FURTHER</h2>
          <p className="bi-p">
            Only if you choose to. You can try the synthetic example above to see what a finished X-Ray looks like with
            fictional numbers, or{" "}
            <a href="/contact">talk to Kyle</a>{" "}
            about a small measured trial. Nothing here signs you up to anything, and nothing is sent until you reach out yourself.
          </p>
          <p className="bi-p" style={{ color: "var(--pe-faint)", fontSize: "var(--pe-fs-sm)" }}>
            Kyle Deligny · Titanos · ABN 34 318 502 254 · Brisbane QLD · How your answers are handled is on the{" "}
            <a href="/privacy">privacy page</a>.
          </p>
        </div>
      </SectionReveal>
    </>
  );
}
