// Onboarding steps per offer, shown on the success page and returned by the Worker (/checkout/onboarding?slug=).
// Built from the offer's own three "how it works" steps plus a group-specific intake list. No timing promises beyond
// what the offer data already says. Pure data, no secrets.
import { getOffer, isRecurring } from "./engine.mjs";

const INTAKE_BY_GROUP = {
  tradies: ["Business name", "ABN", "Trade and service area", "Best phone number", "Your website or Google Business link"],
  multipliers: ["Business name", "ABN", "Number of clients you serve", "Main contact email", "Logo for your branded copy (optional)"],
  government: ["Organisation or agency", "ABN", "Panel or tender reference (if any)", "Main contact email", "Closing date (if any)"],
  enterprise: ["Organisation", "ABN or company number", "Domains in scope", "Executive sponsor email", "Anything off limits"],
  sales: ["Business name", "ABN", "What you sell and to whom", "Main contact email", "Your website"],
  selfserve: ["Name", "Email to deliver to", "Domain or business in scope"],
  specialist: ["Organisation", "ABN", "Domains or systems in scope", "Main contact email", "Anything off limits"],
};

export function onboardingFor(slug) {
  const o = getOffer(slug);
  if (!o) return null;
  const rec = isRecurring(o);
  const steps = [
    { n: 1, title: "Payment received", detail: "Stripe confirms your payment on screen. Nothing else is charged without your say." },
    { n: 2, title: "Tell us what to start on", detail: "Reply to your receipt email, or email kyle@titanos.tech, with the details below. Public records only; we never ask for passwords.", intake: INTAKE_BY_GROUP[o.group] || INTAKE_BY_GROUP.specialist },
    ...o.howItWorks.map((h, i) => ({ n: 3 + i, title: `Step ${i + 1}`, detail: h })),
    { n: 6, title: rec ? "Your monthly rhythm" : "Delivery and follow-up", detail: rec ? "Each month you get the next report by email. Cancel any time by email; no refund for the current month." : "You get the finished pack by email. If something is wrong or missing, reply and we fix it." },
  ];
  return { slug, name: o.name, recurring: rec, steps };
}
