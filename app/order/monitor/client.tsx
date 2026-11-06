"use client";

import PortalCheckout, { type CheckoutProduct } from "@/components/PortalCheckout";
import { DISPLAY } from "@/lib/pricing";

const PRODUCTS: CheckoutProduct[] = [
  { id: "monitor_monthly", label: `Monthly (${DISPLAY.MONITOR_MONTHLY})`, needsDomain: true },
  { id: "monitor_annual", label: `Annual (${DISPLAY.MONITOR_ANNUAL})`, needsDomain: true },
];

export default function OrderMonitorClient() {
  return <PortalCheckout heading="Pay for Monitor" products={PRODUCTS} />;
}
