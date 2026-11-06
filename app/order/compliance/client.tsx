"use client";

import PortalCheckout, { type CheckoutProduct } from "@/components/PortalCheckout";
import { DISPLAY } from "@/lib/pricing";

const PRODUCTS: CheckoutProduct[] = [
  { id: "compliance_pack", label: `Privacy Act + Essential Eight Compliance (${DISPLAY.PACK_PRICE} one-time, 3 months of Monitor included)`, needsDomain: true },
];

export default function OrderComplianceClient() {
  return <PortalCheckout heading="Pay for the compliance pack" products={PRODUCTS} />;
}
