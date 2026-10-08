import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import OrderComplianceClient from "./client";
import { Inscription, SystemLabel, OperatorNote, OmegaSeal } from "@/components/Myth";
import { DISPLAY, PRICING } from "@/lib/pricing";

const baseMetadata: Metadata = {
  title: "Privacy Act Compliance Enquiry | TITANOS",
  description: "Structured intake for Titanos Privacy Act compliance engagement. Done-with-you in one working call.",
  alternates: { canonical: "https://titanos.tech/order/compliance" },
  robots: { index: false, follow: false },
};

export const metadata: Metadata = withSeo("/order/compliance", baseMetadata);

export default function OrderCompliancePage() {
  return (
    <>
      <section aria-label="What this gets you" style={{ padding: "var(--space-16) 20px 0" }}>
        <Inscription
          as="h1"
          label="What this enquiry actually starts"
          sub={`${DISPLAY.PACK_PRICE} one-time, done with you in one working call, plus ${PRICING.PACK_INCLUDED_MONITOR_MONTHS} months of ongoing monitor included.`}
        >
          A scoped fix, not a generic checklist.
        </Inscription>
        <SystemLabel style={{ textAlign: "center", marginTop: 18 }}>
          Enquiry → Kyle scopes your risk → invoice → working call arranged
        </SystemLabel>
      </section>

      <OrderComplianceClient />

      <section aria-label="After you submit" style={{ padding: "0 20px var(--space-16)" }}>
        <OperatorNote style={{ margin: "0 auto var(--space-8)" }}>
          I read every scope personally before it becomes an invoice. Nothing gets charged until
          you&apos;ve seen exactly what&apos;s covered.
        </OperatorNote>
        <OmegaSeal
          caption="Fourteen-day refund if no deliverable has been issued."
          style={{ margin: "0 auto" }}
        />
      </section>
    </>
  );
}
