import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Redirecting… — TITANOS",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://titanos.tech/scan#self-scan" },
};

export default function OurScanLayout({ children }: { children: React.ReactNode }) {
  return children;
}
