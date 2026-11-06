"use client";

import PortalCheckout, { type CheckoutProduct } from "@/components/PortalCheckout";
import { DISPLAY } from "@/lib/pricing";

const PRODUCTS: CheckoutProduct[] = [
  { id: "ai_growth", label: `AI Growth Partner, ${DISPLAY.AI_GROWTH_PARTNER} (${DISPLAY.AI_RETAINER_MIN})`, needsDomain: false },
  { id: "ai_ops", label: `AI Ops Partner, ${DISPLAY.AI_OPS_PARTNER} (${DISPLAY.AI_RETAINER_MIN})`, needsDomain: false },
  { id: "ai_embedded", label: `Embedded AI Partner, ${DISPLAY.AI_EMBEDDED_PARTNER} (${DISPLAY.AI_RETAINER_MIN})`, needsDomain: false },
];

export default function OrderAiClient() {
  return <PortalCheckout heading="Start an AI partnership" products={PRODUCTS} />;
}
