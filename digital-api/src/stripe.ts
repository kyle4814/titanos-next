// Stripe Checkout Session creation over fetch (form encoded), AUD only, price from the catalogue only.
// The key must match the declared mode (sk_live_ only with mode "live"), so a live key can never run in a test deploy.
import type { DigitalItem } from "./catalogue.ts";

export type StripeMode = "test" | "live";
export function checkKeyMode(key: string, mode: StripeMode): boolean {
  return key.startsWith(mode === "live" ? "sk_live_" : "sk_test_") || key.startsWith(`rk_${mode}_`);
}

export async function createCheckoutSession(o: { key: string; mode: StripeMode; item: DigitalItem; siteOrigin: string; email?: string; fetchFn?: typeof fetch }): Promise<{ id: string; url: string }> {
  if (!checkKeyMode(o.key, o.mode)) throw new Error("stripe_key_mode_mismatch");
  const b: Record<string, string> = {
    mode: "payment",
    success_url: `${o.siteOrigin}/order/digital/thanks?s={CHECKOUT_SESSION_ID}`,
    cancel_url: `${o.siteOrigin}/shop/digital/${o.item.slug}`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "aud",
    "line_items[0][price_data][unit_amount]": String(o.item.priceCents),
    "line_items[0][price_data][product_data][name]": o.item.title,
    "metadata[kind]": "digital", "metadata[slug]": o.item.slug,
    "payment_intent_data[metadata][kind]": "digital", "payment_intent_data[metadata][slug]": o.item.slug,
  };
  if (o.email) b.customer_email = o.email;
  const r = await (o.fetchFn ?? fetch)("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${o.key}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(b).toString(),
  });
  if (!r.ok) throw new Error(`stripe_${r.status}`);
  const j = (await r.json()) as { id?: unknown; url?: unknown };
  if (typeof j.id !== "string" || typeof j.url !== "string") throw new Error("stripe_bad_response");
  return { id: j.id, url: j.url };
}
