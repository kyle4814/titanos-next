import type { Metadata } from "next";
import OrderMonitorClient from "./client";

export const metadata: Metadata = {
  title: "Monthly Security Monitor Enquiry | TITANOS",
  description: "Structured intake for Titanos Continuous Monitor. Monthly external security scan with delta alerts.",
  robots: { index: false, follow: false },
};

export default function OrderMonitorPage() {
  return <OrderMonitorClient />;
}
