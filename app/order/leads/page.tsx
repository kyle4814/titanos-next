import type { Metadata } from "next";
import { Suspense } from "react";
import OrderLeadsClient from "./client";

export const metadata: Metadata = {
  title: "Verified AU Leads Enquiry | TITANOS",
  description: "Enquiry form for Titanos verified AU contact lists. Tell Kyle what type of business you want to reach — he builds the verified list.",
  robots: { index: false, follow: false },
};

export default function OrderLeadsPage() {
  return (
    <Suspense>
      <OrderLeadsClient />
    </Suspense>
  );
}
