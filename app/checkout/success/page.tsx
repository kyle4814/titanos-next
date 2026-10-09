import type { Metadata } from "next";
import { Suspense } from "react";
import { withSeo } from "@/lib/seo";
import SuccessClient from "./client";

export const metadata: Metadata = withSeo("/checkout/success", {
  title: "You are in | TITANOS",
  description: "Payment received. Here is exactly what happens next.",
  alternates: { canonical: "https://titanos.tech/checkout/success" },
  robots: { index: false, follow: false },
});

export default function SuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessClient />
    </Suspense>
  );
}
