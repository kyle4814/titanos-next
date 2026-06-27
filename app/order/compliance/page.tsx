import type { Metadata } from "next";
import OrderComplianceClient from "./client";

export const metadata: Metadata = {
  title: "Order Compliance AU | TITANOS",
  description: "Structured intake for Titanos Privacy Act compliance engagement. Done-with-you in one working call.",
  robots: { index: false, follow: false },
};

export default function OrderCompliancePage() {
  return <OrderComplianceClient />;
}
