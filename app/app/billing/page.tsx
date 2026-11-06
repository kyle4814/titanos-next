import type { Metadata } from "next";
import BillingClient from "./client";

export const metadata: Metadata = {
  title: "Billing | TITANOS",
  description: "Your purchases, invoices, cancellation, refunds and data.",
  alternates: { canonical: "https://titanos.tech/app/billing" },
  robots: { index: false, follow: false },
};
export default function BillingPage() { return <BillingClient />; }
