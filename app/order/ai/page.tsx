import type { Metadata } from "next";
import { Suspense } from "react";
import OrderAiClient from "./client";

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
    <Suspense>
      <OrderAiClient />
    </Suspense>
  );
}
