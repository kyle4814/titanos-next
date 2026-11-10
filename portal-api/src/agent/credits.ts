// Metered credits. 1 credit = AU$0.01 (EXAMPLE rate, Kyle fixes it). Prepaid only: a call never runs on credit
// we have not been paid for. Top-ups are bought through the billing provider (mock in tests, Stripe test mode
// later) and granted by the signed webhook, idempotently by Stripe event id.
import { HttpError, type Deps } from "../service.ts";
import type { Account } from "../store.ts";
import { randomToken } from "../util.ts";

export const CREDIT_PACKS: Record<string, { id: string; credits: number; amountCents: number }> = {
  credits_2000: { id: "credits_2000", credits: 2000, amountCents: 2000 },
  credits_10000: { id: "credits_10000", credits: 10000, amountCents: 10000 },
  credits_50000: { id: "credits_50000", credits: 50000, amountCents: 50000 },
};

export async function startTopup(d: Deps, a: Account, packId: unknown) {
  const pack = typeof packId === "string" ? CREDIT_PACKS[packId] : undefined;
  if (!pack) throw new HttpError(400, "unknown_pack");
  const id = randomToken("cord", 8);
  const co = await d.billing.createCheckout({
    email: a.email, mode: "payment", name: `${pack.credits} TITANOS agent credits`, amountCents: pack.amountCents, accountId: a.id,
    productId: pack.id, successUrl: `${d.siteOrigin}/agents?topup=${id}`, cancelUrl: `${d.siteOrigin}/agents?cancelled=1`, idempotencyKey: id,
  });
  await d.store.putCreditOrder({ id, accountId: a.id, checkoutId: co.id, packId: pack.id, credits: pack.credits, paid: false });
  return { orderId: id, checkoutUrl: co.url, credits: pack.credits, amountCents: pack.amountCents, currency: "aud" };
}

// Called by the webhook route BEFORE the purchase handler. Returns null when the event is not a credit order.
export async function handleCreditEvent(d: Deps, ev: { id: string; type: string; data: { object: Record<string, any> } }): Promise<"handled" | "duplicate" | "ignored" | null> {
  if (ev.type !== "checkout.session.completed" && ev.type !== "checkout.session.async_payment_succeeded") return null;
  const order = await d.store.creditOrderByCheckout(String(ev.data.object.id));
  if (!order) return null;
  if (ev.data.object.payment_status === "unpaid") return "ignored";   // F-C2: do not burn the event id; async_payment_succeeded fulfils later
  if (!(await d.store.claimEvent(ev.id))) return "duplicate";
  if (order.paid) return "ignored";
  order.paid = true; await d.store.putCreditOrder(order);
  await d.store.creditApply(order.accountId, order.credits, "topup", ev.id, d.now());
  return "handled";
}
