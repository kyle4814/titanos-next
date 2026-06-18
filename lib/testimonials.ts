/**
 * Testimonials registry.
 *
 * EMPTY BY DESIGN. The page-level <Testimonials /> render block must
 * render nothing while this array is empty — no sample copy, no
 * placeholder names, no fabricated companies. Add real entries here
 * only after a customer gives explicit permission to publish.
 *
 * After the third real entry lands, also flip the /compliance CTAs
 * back to buy-primary / call-secondary (see the FLIP comment on
 * app/compliance/page.tsx).
 */

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  company: string;
  offer: "scan" | "compliance" | "ai-delivery";
  // When set, signals the customer has explicitly OK'd publication.
  // Without this flag, do not surface the quote.
  consentToPublish: true;
};

export const TESTIMONIALS: Testimonial[] = [];
