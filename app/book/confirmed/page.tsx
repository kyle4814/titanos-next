import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import Confirmed from "@/components/book/Confirmed";

export const metadata: Metadata = withSeo("/book/confirmed", {
  title: "Your call is booked | TITANOS",
  description: "Confirmation of your booked call with Kyle.",
  robots: { index: false, follow: false },
});

export default function BookConfirmedPage() {
  return (
    <>
      <PageHero badge="BOOKED" title="Your call is booked." />
      <Confirmed />
    </>
  );
}
