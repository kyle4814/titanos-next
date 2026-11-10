import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import { Suspense } from "react";
import FormFallback from "@/components/FormFallback";
import OrderAiClient from "./client";
import { Inscription, SystemLabel, OperatorNote, OmegaSeal } from "@/components/Myth";
import { DISPLAY } from "@/lib/pricing";

const META_TITLE = "AI Partnership Checkout | TITANOS";
const META_DESC =
  "Start a Titanos AI partnership retainer. Choose your tier, pay on Stripe, and month 1 scoping begins.";

const baseMetadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  openGraph: { title: META_TITLE, description: META_DESC },
  alternates: { canonical: "https://titanos.tech/order/ai" },
  robots: { index: false, follow: false },
};

export const metadata: Metadata = withSeo("/order/ai", baseMetadata);

export default function OrderAiPage() {
  return (
    <>
      <section aria-label="What this gets you" style={{ padding: "var(--space-16) 20px 0" }}>
        <Inscription
          as="h1"
          label="What this checkout actually starts"
          sub={`${DISPLAY.AI_LADDER_ENTRY}. Month 1 is the build, months 2 to 3 optimise, then it runs month-to-month. Cancel any time.`}
        >
          One system, built around the work you already do manually.
        </Inscription>
        <SystemLabel style={{ textAlign: "center", marginTop: 18 }}>
          Sign in → choose your tier → pay → month 1 scoping begins
        </SystemLabel>
      </section>

      <Suspense fallback={<FormFallback minHeight={1280} />}>
        <OrderAiClient />
      </Suspense>

      <section aria-label="After you submit" style={{ padding: "0 20px var(--space-16)" }}>
        <OperatorNote style={{ margin: "0 auto var(--space-8)" }}>
          I scope every build myself. No sales team, no queue. If the tier you pick is wrong for
          the work, I will tell you in week one and move you before the next charge.
        </OperatorNote>
        <OmegaSeal
          caption="Month 1 scoping before any build starts."
          style={{ margin: "0 auto" }}
        />
      </section>
    </>
  );
}
