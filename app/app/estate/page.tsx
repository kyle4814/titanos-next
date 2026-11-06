import type { Metadata } from "next";
import EstateClient from "./client";

export const metadata: Metadata = {
  title: "Estate | TITANOS",
  description: "Your organisation's domains, findings, members and single sign-on.",
  alternates: { canonical: "https://titanos.tech/app/estate" },
  robots: { index: false, follow: false },
};
export default function EstatePage() { return <EstateClient />; }
