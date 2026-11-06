import type { Metadata } from "next";
import LoginClient from "./client";

export const metadata: Metadata = {
  title: "Sign in | TITANOS",
  description: "One login for your TITANOS scans, billing and invoices.",
  alternates: { canonical: "https://titanos.tech/app/login" },
  robots: { index: false, follow: false },
};
export default function LoginPage() { return <LoginClient />; }
