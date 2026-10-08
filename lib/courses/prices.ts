// Course prices (AUD). Every figure is an existing rung of the titanos.tech ladder (lib/offers/data): 149 = Supplier Check
// Dossier / Compliance Monitor rung, 297 = Due Diligence Pre-Read rung. Rendered only through formatAUD; never typed into copy.
// Payment links are NOT set here: they go live only on Kyle's batch card (lib/products/links.json pattern, GATE1).
export const COURSE_PRICES_AUD: Record<string, number> = {
  "dmarc-for-small-business": 149,
  "hours-back-ai-small-office": 149,
  "public-records-due-diligence": 297,
};
