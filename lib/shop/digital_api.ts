// The checkout Worker (digital-api) origin. Kept in its own tiny module so client components import ONLY this string,
// never lib/shop/digital.ts (which pulls the whole catalogue JSON into the browser bundle).
// api.titanos.tech is already in the site CSP connect-src; pointing it at the Worker is a go-live step (runbook step 9).
export const DIGITAL_API_BASE = "https://api.titanos.tech";
