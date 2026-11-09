import type { Metadata } from "next";
import KeysClient from "./client";

export const metadata: Metadata = {
  title: "API keys | TITANOS",
  description: "Create, limit and revoke the API keys software uses to call TITANOS on your account.",
  alternates: { canonical: "https://titanos.tech/app/keys" },
  robots: { index: false, follow: false },
};
export default function KeysPage() { return <KeysClient />; }
