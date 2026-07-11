import type { Metadata } from "next";
import { Suspense } from "react";
import OrderAiClient from "./client";

export const metadata: Metadata = {
  title: "AI Implementation Enquiry | TITANOS",
  description: "Structured intake for Titanos AI Implementation. Describe the manual work you want eliminated — Kyle scopes and builds.",
  robots: { index: false, follow: false },
};

export default function OrderAiPage() {
  return (
    <Suspense>
      <OrderAiClient />
    </Suspense>
  );
}
