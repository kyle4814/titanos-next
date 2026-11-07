import type { Metadata } from "next";
import SeatAnchors from "@/components/SeatAnchors";
import { ANCHORS } from "./anchors";
import ProClient from "./client";

export const metadata: Metadata = {
  title: "Pro seat | TITANOS",
  description: "Hand-raised jobs with the proof attached, paid only after a re-scan shows the fault gone, and a rank built from proven fixes.",
  alternates: { canonical: "https://titanos.tech/pro" },
  robots: { index: false, follow: false },
};
export default function ProPage() { return <><ProClient /><SeatAnchors rows={ANCHORS} /></>; }
