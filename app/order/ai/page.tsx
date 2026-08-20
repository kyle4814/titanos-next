import type { Metadata } from "next";
import { Suspense } from "react";
import OrderAiClient from "./client";
import { Inscription, SystemLabel, OperatorNote, OmegaSeal } from "@/components/Myth";
import { DISPLAY } from "@/lib/pricing";

const META_TITLE = "AI Partnership Enquiry | TITANOS";
const META_DESC =
  "Structured intake for a Titanos AI partnership retainer. Describe the manual work you want automated — Kyle confirms your tier and scopes month 1.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  openGraph: { title: META_TITLE, description: META_DESC },
  robots: { index: false, follow: false },
};

export default function OrderAiPage() {
  return (
    <>
      <section aria-label="What this gets you" style={{ padding: "var(--space-16) 20px 0" }}>
        <Inscription
          label="What this enquiry actually starts"
          sub={`${DISPLAY.AI_LADDER_ENTRY}. Month 1 is the build, months 2–3 optimise, then it runs month-to-month — cancel any time.`}
        >
          One system, built around the work you already do manually.
        </Inscription>
        <SystemLabel style={{ textAlign: "center", marginTop: 18 }}>
          Enquiry → Kyle scopes your tier → invoice → month 1 build begins
        </SystemLabel>
      </section>

      <Suspense>
        <OrderAiClient />
      </Suspense>

      <section aria-label="After you submit" style={{ padding: "0 20px var(--space-16)" }}>
        <OperatorNote style={{ margin: "0 auto var(--space-8)" }}>
          I read every enquiry myself — no sales team, no queue. If your tier isn&apos;t obvious
          from what you write, I&apos;ll ask before I quote, not after.
        </OperatorNote>
        <OmegaSeal
          caption="Scope confirmed before anything is invoiced."
          style={{ margin: "0 auto" }}
        />
      </section>
    </>
  );
}
