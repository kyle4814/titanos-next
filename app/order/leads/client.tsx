"use client";

import PortalCheckout, { type CheckoutProduct } from "@/components/PortalCheckout";
import { DISPLAY } from "@/lib/pricing";

const PRODUCTS: CheckoutProduct[] = [
  { id: "leads_starter", label: `Starter, 250 contacts (${DISPLAY.LEADS_STARTER})`, needsDomain: false },
  { id: "leads_growth", label: `Growth, 1,000 contacts (${DISPLAY.LEADS_GROWTH})`, needsDomain: false },
  { id: "leads_campaign", label: `Full Campaign, 3,000 contacts (${DISPLAY.LEADS_CAMPAIGN})`, needsDomain: false },
  { id: "leads_retainer", label: `Ongoing Retainer (${DISPLAY.LEADS_RETAINER})`, needsDomain: false },
];

export default function OrderLeadsClient() {
  return <PortalCheckout heading="Order leads" products={PRODUCTS} />;
}
