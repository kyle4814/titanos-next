import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DEMO: shift fill sketch | TITANOS",
  description: "Unlisted demo with synthetic records.",
  robots: { index: false, follow: false },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
