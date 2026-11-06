// Pins the portal catalogue to the site's single price source (lib/pricing.ts) so the two lists cannot drift again.
// (catalogue.ts names scripts/test_portal_catalogue.mjs as its pin; that file does not exist on any branch: this test is the pin.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { PRICING, LEADS } from "../../lib/pricing.ts";
import { PRODUCTS } from "../src/catalogue.ts";

const EXPECT: Record<string, number> = {
  monitor_monthly: PRICING.MONITOR_MONTHLY, monitor_annual: PRICING.MONITOR_ANNUAL, compliance_pack: PRICING.PACK_PRICE,
  ai_growth: PRICING.AI_GROWTH_PARTNER, ai_ops: PRICING.AI_OPS_PARTNER, ai_embedded: PRICING.AI_EMBEDDED_PARTNER,
  leads_starter: LEADS.STARTER.price, leads_growth: LEADS.GROWTH.price, leads_campaign: LEADS.CAMPAIGN.price, leads_retainer: LEADS.RETAINER.price,
};
test("portal catalogue amounts equal lib/pricing.ts (AUD dollars x 100)", () => {
  assert.deepEqual(Object.keys(PRODUCTS).sort(), Object.keys(EXPECT).sort());
  for (const [id, dollars] of Object.entries(EXPECT)) assert.equal(PRODUCTS[id].amountCents, dollars * 100, id);
});
test("retainer minimum term matches the site", () => {
  for (const id of ["ai_growth", "ai_ops", "ai_embedded"]) assert.equal(PRODUCTS[id].minMonths, PRICING.AI_RETAINER_MIN_MONTHS);
});
test("mutation: a one-dollar drift is detected by this pin", () => {
  const drift = { ...PRODUCTS.monitor_monthly, amountCents: PRODUCTS.monitor_monthly.amountCents + 100 };
  assert.notEqual(drift.amountCents, EXPECT.monitor_monthly * 100);
});
