import type { Metadata } from "next";
import PartnerClient from "./client";

export const metadata: Metadata = {
  title: "Partner | TITANOS",
  description: "Your client portals, commission ledger and payouts.",
  alternates: { canonical: "https://titanos.tech/app/partner" },
  robots: { index: false, follow: false },
};
export default function PartnerPage() { return <PartnerClient />; }
