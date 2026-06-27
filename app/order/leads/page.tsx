import type { Metadata } from "next";
import { Suspense } from "react";
import OrderLeadsClient from "./client";

export const metadata: Metadata = {
  title: "Order Lead Generation | TITANOS",
  description: "Structured intake for Titanos lead generation. Tell Kyle your ICP — he builds the list and runs the outreach.",
  robots: { index: false, follow: false },
};

export default function OrderLeadsPage() {
  return (
    <Suspense>
      <OrderLeadsClient />
    </Suspense>
  );
}
