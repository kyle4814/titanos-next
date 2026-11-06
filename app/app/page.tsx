import type { Metadata } from "next";
import OwnerClient from "./client";

export const metadata: Metadata = {
  title: "My Level | TITANOS",
  description: "Your Business Level, findings with proof, one-tap fixes, the stays-fixed monitor and reports.",
  alternates: { canonical: "https://titanos.tech/app" },
  robots: { index: false, follow: false },
};
export default function OwnerPage() { return <OwnerClient />; }
