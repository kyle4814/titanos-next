import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import { Inscription } from "@/components/Myth";
import DigitalThanksClient from "./client";

const baseMetadata: Metadata = {
  title: "Thank you, your download is on its way | TITANOS",
  description: "Your payment went through. A private download link is emailed to you.",
  alternates: { canonical: "https://titanos.tech/order/digital/thanks" },
  robots: { index: false, follow: false },
};
export const metadata: Metadata = withSeo("/order/digital/thanks", baseMetadata);

export default function DigitalThanksPage() {
  return (
    <>
      <section aria-label="Order received" style={{ padding: "var(--space-16) 20px var(--space-8)" }}>
        <Inscription as="h1" label="Order received" sub="One private link, valid for 7 days and 5 downloads.">
          Thank you. Your files are on the way.
        </Inscription>
      </section>
      <DigitalThanksClient />
    </>
  );
}
