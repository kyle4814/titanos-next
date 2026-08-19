/**
 * Site-wide config. Operator (Kyle) updates these by hand.
 *
 * MONTHLY_COMPLIANCE_SLOTS and CURRENT_BOOKING_MONTH drive scarcity
 * copy on /compliance + the homepage Offer 02 sub-line. Stale values
 * are worse than none — bump them when each month closes. See
 * ops/UPDATE_MONTHLY.md.
 *
 * FLASK_FORM_ENDPOINT is the POST target for the free-scan request
 * form. The Flask handler lives at ops/flask_scan_request_route.py
 * and must be deployed to api.titanos.tech before form submissions
 * resolve.
 */

type SiteConfig = {
  FORM_BACKEND: "flask" | "formspree";
  FLASK_FORM_ENDPOINT: string;
  FORMSPREE_ID: string;
  MONTHLY_COMPLIANCE_SLOTS: number;
  CURRENT_BOOKING_MONTH: string;
  CAL_15MIN_URL: string;
  CAL_30MIN_URL: string;
  AUDIT_CALL_URL: string;
  LINKEDIN_URL: string;
  PHOTO_PATH: string;
  API_BASE_URL: string;
  STRIPE_COMPLIANCE_LINK: string;
  KYLE_EMAIL: string;
  ORDER_SUBMIT_URL: string;
};

// Typed as SiteConfig so empty-string placeholders stay `string`, not
// narrowed to literal `""`. Without this, `{SITE.X && <Foo/>}` collapses
// X to `never` in the truthy branch and TS errors on any method call.
export const SITE: SiteConfig = {
  // Form backend toggle. "flask" = POST to FLASK_FORM_ENDPOINT.
  // "formspree" = POST to https://formspree.io/f/<FORMSPREE_ID>.
  FORM_BACKEND: "flask",
  FLASK_FORM_ENDPOINT: "https://api.titanos.tech/scan/request",
  FORMSPREE_ID: "",

  // Compliance capacity — drives slot-based scarcity copy.
  MONTHLY_COMPLIANCE_SLOTS: 4,
  CURRENT_BOOKING_MONTH: "July",

  // Call URLs.
  CAL_15MIN_URL: "https://cal.com/kyle-deligny-msvz6s/15min",
  // OPERATOR_INPUT: create a real 30-min cal.com event, paste URL here.
  // Until provided, AI-page scoping CTAs are relabelled "BOOK A SCOPING
  // CALL · 15 MIN" and route to CAL_15MIN_URL.
  CAL_30MIN_URL: "",

  // Free AI Audit Call booking link — dedicated 45-min cal.com event
  // (id 6330616), created 2026-07-16 so the audit call isn't capped at 15min.
  AUDIT_CALL_URL: "https://cal.com/kyle-deligny-msvz6s/ai-audit",

  // Operator identity slots (Fix 2b).
  // OPERATOR_INPUT: paste LinkedIn profile URL.
  LINKEDIN_URL: "",
  // OPERATOR_INPUT: drop file into /public and set path here, e.g.
  // "/kyle.jpg". When empty, the photo slot and the operator byline
  // adjacent to /compliance pricing both render nothing.
  PHOTO_PATH: "/kyle.jpg",

  // API base — the Flask server at api.titanos.tech. Used by the
  // /scan-request form (existing) and the Monitor checkout flow (new).
  // CSP connect-src must allow this origin (already does — layout.tsx).
  API_BASE_URL: "https://api.titanos.tech",

  // Stripe Payment Link for the compliance offer.
  STRIPE_COMPLIANCE_LINK: "https://buy.stripe.com/3cIfZh017cGd80QgGa1RC43",

  // Single-source mailto for the error-fallback inside the scan form
  // and the footer/about contact mention.
  KYLE_EMAIL: "kyle@titanos.tech",

  // Order intake endpoint — the unified POST /order/submit Worker route.
  ORDER_SUBMIT_URL: "https://api.titanos.tech/order/submit",
};

// Derived helpers.
// Sitewide primary CTAs route here (internal anchor) instead of the raw
// external cal.com URL, so the audit call is booked inline via CalEmbed
// on /audit without an external-tab hop. /audit itself still offers the
// external link as a fallback if the embed doesn't load.
export const AUDIT_BOOK_HREF = "/audit#book";
export const SCOPING_CALL_URL = SITE.CAL_30MIN_URL || SITE.CAL_15MIN_URL;
export const SCOPING_CALL_LABEL = SITE.CAL_30MIN_URL
  ? "BOOK A 30-MIN SCOPING CALL"
  : "BOOK A SCOPING CALL · 15 MIN";
