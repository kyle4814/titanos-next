import type { Metadata } from "next";
import OrderMonitorClient from "./client";
import { Inscription, SystemLabel, OperatorNote, OmegaSeal } from "@/components/Myth";
import { DISPLAY } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Monthly Security Monitor Enquiry | TITANOS",
  description: "Structured intake for Titanos Continuous Monitor. Monthly external security scan with delta alerts.",
  robots: { index: false, follow: false },
};

export default function OrderMonitorPage() {
  return (
    <>
      <section aria-label="What this gets you" style={{ padding: "var(--space-16) 20px 0" }}>
        <Inscription
          label="What this enquiry actually starts"
          sub={`${DISPLAY.MONITOR_MONTHLY}, or ${DISPLAY.MONITOR_ANNUAL} paid annually. Cancel any time from the billing portal.`}
        >
          A monthly check that tells you what changed — not a one-off scan you forget about.
        </Inscription>
        <SystemLabel style={{ textAlign: "center", marginTop: 18 }}>
          Enquiry → Kyle confirms scope → invoice → monitoring starts same day
        </SystemLabel>
      </section>

      <OrderMonitorClient />

      <section aria-label="After you submit" style={{ padding: "0 20px var(--space-16)" }}>
        <OperatorNote style={{ margin: "0 auto var(--space-8)" }}>
          I set up every monitor myself, and I&apos;m the one reading the delta alerts before
          they reach you — nothing here runs unattended.
        </OperatorNote>
        <OmegaSeal
          caption="Same-day start once the invoice is paid."
          style={{ margin: "0 auto" }}
        />
      </section>
    </>
  );
}
