import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import BookingForm from "@/components/book/BookingForm";

const META_TITLE = "Book a call with Kyle | TITANOS";
const META_DESC = "Pick a 20 minute time that suits you, tell Kyle what eats your week, and he calls you. Free, no obligation, and a no is welcome.";

export const metadata: Metadata = withSeo("/book", {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/book" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/book" },
  robots: { index: true, follow: true },
});

export default function BookPage() {
  return (
    <>
      <PageHero
        badge="BOOK A CALL"
        title="Pick a time. Kyle calls you."
        tagline="Twenty minutes, free, no obligation."
        sub="You tell me what eats your week and I tell you straight whether it is worth automating. If it is not, I will say so. A no is welcome."
      />
      <BookingForm />
    </>
  );
}
