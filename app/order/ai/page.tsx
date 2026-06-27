import type { Metadata } from "next";
import OrderAiClient from "./client";

export const metadata: Metadata = {
  title: "Order AI Implementation | TITANOS",
  description: "Structured intake for Titanos AI Implementation. Describe the manual work you want eliminated — Kyle scopes and builds.",
  robots: { index: false, follow: false },
};

export default function OrderAiPage() {
  return <OrderAiClient />;
}
