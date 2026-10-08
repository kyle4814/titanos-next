import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import { Suspense } from "react";
import FormFallback from "@/components/FormFallback";
import OrderLeadsClient from "./client";
import { Inscription, SystemLabel, OperatorNote, OmegaSeal } from "@/components/Myth";
import { DISPLAY } from "@/lib/pricing";

const baseMetadata: Metadata = {
  title: "Verified AU Leads Enquiry | TITANOS",
  description: "Enquiry form for Titanos verified AU contact lists. Tell Kyle what type of business you want to reach, and he builds the verified list.",
  alternates: { canonical: "https://titanos.tech/order/leads" },
  robots: { index: false, follow: false },
};

export const metadata: Metadata = withSeo("/order/leads", baseMetadata);

export default function OrderLeadsPage() {
  return (
    <>
      <section aria-label="What this gets you" style={{ padding: "var(--space-16) 20px 0" }}>
        <Inscription
          as="h1"
          label="What this enquiry actually starts"
          sub={`${DISPLAY.LEADS_STARTER_FROM}, hand-verified, not scraped and sold as-is.`}
        >
          A list built for the businesses you actually want to reach.
        </Inscription>
        <SystemLabel style={{ textAlign: "center", marginTop: 18 }}>
          Enquiry → Kyle scopes the target profile → proposal → list delivered
        </SystemLabel>
      </section>

      <Suspense fallback={<FormFallback minHeight={1600} />}>
        <OrderLeadsClient />
      </Suspense>

      <section aria-label="After you submit" style={{ padding: "0 20px var(--space-16)" }}>
        <OperatorNote style={{ margin: "0 auto var(--space-8)" }}>
          I check every list myself before it ships. If a target profile is too thin to fill
          properly, I&apos;ll tell you instead of padding it out.
        </OperatorNote>
        <OmegaSeal
          caption="Verified contacts, not a scrape dump."
          style={{ margin: "0 auto" }}
        />
      </section>
    </>
  );
}
