// Data for /email-security/compare (DMARC tools compared, 2026-11-29).
// Every price below was read from the vendor's own public pricing page on 2026-11-29, except where the row says otherwise.
// Prices change often; the page tells the reader to check the vendor page. Nothing here is invented.
// Plain data only (no imports) so the node test can load it.

export const COMPARE_PATH = "/email-security/compare";
export const COMPARE_PUBLISHED = "2026-11-29";
export const COMPARE_REVIEWED = "2026-11-29";
export const COMPARE_REVIEWED_LONG = "29 November 2026";

export type Source = { label: string; url: string };
export type Faq = { q: string; a: string };

export const COMPARE = {
  title: "DMARC tools compared, with public prices",
  description:
    "dmarcian, Valimail, EasyDMARC, PowerDMARC and free options side by side with public prices read on 29 November 2026, plus do it yourself versus managed.",
  h1: "DMARC tools compared: dmarcian, Valimail, EasyDMARC, PowerDMARC and the free options",
};

export type Tool = {
  slug: string;
  name: string;
  pricing: string; // what the public page showed
  priceChecked: string; // how we read it
  freeTier: string;
  goodFor: string;
  watchFor: string;
  source: Source;
};

export const TOOLS: Tool[] = [
  {
    slug: "dmarcian",
    name: "dmarcian",
    pricing:
      "Public tiers shown in USD: Personal US$0 per month (2 domains, 1,250 DMARC-capable messages a month); Basic US$19.99 a month billed yearly or US$24 billed monthly (2 domains, 100,000 messages); Plus US$199 a month billed yearly or US$240 billed monthly (8 domains, 1,000,000 messages); Enterprise US$499 a month billed yearly or US$600 billed monthly (15 domains, 5,000,000 messages). A Custom tier has no price shown.",
    priceChecked: "Read from the vendor pricing page on 29 November 2026.",
    freeTier: "Yes: the Personal tier, with small limits.",
    goodFor: "A business that wants a DMARC-focused tool with prices published openly and a free starting point.",
    watchFor: "Plans are capped by domain count and monthly message volume, and the page says overages are custom priced.",
    source: { label: "dmarcian pricing", url: "https://dmarcian.com/pricing/" },
  },
  {
    slug: "easydmarc",
    name: "EasyDMARC",
    pricing:
      "Public tiers: DMARC Plus from US$35.99 a month billed annually (2 domains, from 100,000 emails a month, 3 months of data); DMARC Premium from US$71.99 a month billed annually (4 domains, from 100,000 emails a month, 1 year of data). Deliverability and Enterprise show custom pricing. The page shows a dollar sign without naming the currency, so we have assumed US dollars.",
    priceChecked: "Read from the vendor pricing page on 29 November 2026. The page also showed higher struck figures (US$44.99 and US$89.99) that we have not treated as the price.",
    freeTier: "Not shown on the pricing page we read. Check the vendor site for a free plan or trial.",
    goodFor: "A small business or agency that wants a wider toolkit around DMARC and clear entry prices.",
    watchFor: "Prices are quoted on annual billing, and email volume options change the figure.",
    source: { label: "EasyDMARC pricing", url: "https://easydmarc.com/pricing" },
  },
  {
    slug: "powerdmarc",
    name: "PowerDMARC",
    pricing:
      "As summarised from the vendor pricing page: a Free plan (1 domain, up to 10,000 DMARC-compliant emails a month); Basic priced by monthly email volume at about US$8 to US$250 a month with annual billing discounted by 20 percent; Enterprise and MSP with custom pricing. Third-party listings disagree with this (some show per-user pricing), so treat the figures as indicative.",
    priceChecked: "The vendor page returned an access error when we tried to open it directly on 29 November 2026, so these figures came from a search summary of that page. Confirm them on the vendor site before you rely on them.",
    freeTier: "Yes, according to the summary: one domain with a low email limit.",
    goodFor: "A very small sender who wants to start free, or a managed service provider looking after several client domains.",
    watchFor: "The price depends on monthly email volume, so a busy sender moves up the range quickly.",
    source: { label: "PowerDMARC pricing", url: "https://powerdmarc.com/power-dmarc-pricing-policy/" },
  },
  {
    slug: "valimail",
    name: "Valimail",
    pricing:
      "Valimail publishes no prices for its paid Enforce tiers (Starter, Premium, Enterprise): each says contact us for custom pricing. It lists a free Monitor tier with 5 users and a limited automated DMARC feature.",
    priceChecked: "Read from the vendor pricing page on 29 November 2026.",
    freeTier: "Yes: Monitor, with stated limits.",
    goodFor: "A larger organisation that wants automated enforcement and is happy to go through a sales conversation.",
    watchFor: "You cannot see the paid price before you talk to the vendor, so a fair cost comparison needs a quote.",
    source: { label: "Valimail pricing", url: "https://www.valimail.com/pricing/" },
  },
];

export type FreeOption = { name: string; what: string; price: string; source: Source };

export const FREE_OPTIONS: FreeOption[] = [
  {
    name: "Cloudflare DMARC Management",
    what: "Tracks the sources sending email as your domain and shows SPF, DKIM and DMARC results for each. Needs your domain on Cloudflare DNS.",
    price: "Cloudflare's documentation says it is available on all plans and does not state a separate price. Check your own plan.",
    source: { label: "Cloudflare DMARC Management documentation", url: "https://developers.cloudflare.com/dmarc-management/" },
  },
  {
    name: "Free tiers from the paid tools",
    what: "dmarcian Personal and the Valimail Monitor tier are free with limits, and PowerDMARC lists a free plan. Limits are small, so a business with several senders may outgrow them.",
    price: "US$0 for the tiers named above, as read on 29 November 2026.",
    source: { label: "dmarcian pricing", url: "https://dmarcian.com/pricing/" },
  },
  {
    name: "A mailbox you read yourself",
    what: "A DMARC record can send raw aggregate reports to an inbox you control. The reports are XML files, hard to read by eye, so most people pair this with a free viewer.",
    price: "No tool cost. It costs your time.",
    source: { label: "RFC 7489: DMARC", url: "https://datatracker.ietf.org/doc/html/rfc7489" },
  },
];

export type DiyRow = { question: string; diy: string; managed: string };

export const DIY_VS_MANAGED: DiyRow[] = [
  {
    question: "What you pay",
    diy: "A free tier, or a monthly tool fee like those above. Your own time reading reports and fixing senders.",
    managed: "A fee for a person to run it. TITANOS has no public DMARC-only price yet, so we quote after a free audit call.",
  },
  {
    question: "Who reads the reports",
    diy: "You or your IT person, weekly for the first month and then now and then.",
    managed: "The provider reads them and tells you what needs a decision.",
  },
  {
    question: "Speed to enforcement",
    diy: "Depends on how many systems send as your domain and how often you look. Our setup guides lay out about eight weeks from p=none to quarantine for a small business with a handful of senders.",
    managed: "Often similar, because the wait is for reports to build up, not for effort. The gain is less of your time and fewer mistakes.",
  },
  {
    question: "Risk of blocking your own mail",
    diy: "Real if you jump to reject early. The staged rollout on our setup guides keeps it low.",
    managed: "Lower when someone experienced reads the reports before each change.",
  },
  {
    question: "Best fit",
    diy: "One or two domains, a technical owner or IT contact, and a few sending systems.",
    managed: "Many domains, no one with time, or mail that carries invoices and bookings you cannot afford to lose.",
  },
];

export const FAQ: Faq[] = [
  {
    q: "Do I need a paid DMARC tool?",
    a: "Not to publish DMARC. The record itself costs nothing. A tool turns the XML reports into something a person can read. For one small domain, a free tier is often enough to start.",
  },
  {
    q: "Which tool is cheapest?",
    a: "It depends on your domains and email volume. On the pages we read on 29 November 2026, dmarcian, Valimail and PowerDMARC each list a free tier, and the paid entry points are in the table above. Limits differ, so the lowest monthly figure is not always the lowest cost per domain or per message.",
  },
  {
    q: "Are these prices in Australian dollars?",
    a: "dmarcian states its prices are in USD. EasyDMARC does not name a currency on the page we read. Convert before you compare with an Australian quote, and add GST if it applies to you.",
  },
  {
    q: "Does TITANOS sell or earn commission from any of these tools?",
    a: "No tool on this page pays us to be listed, and the links go to each vendor's own pages with no tracking added by us. We do sell our own setup guide and audit call, and we say so where we mention them.",
  },
  {
    q: "How often do you update the prices?",
    a: "We re-read the pages when we review this one. The review date is at the top. Vendors change prices without notice, so always confirm on the vendor page before you buy.",
  },
];

export const SOURCES: Source[] = [
  ...TOOLS.map((t) => t.source),
  { label: "Cloudflare DMARC Management documentation", url: "https://developers.cloudflare.com/dmarc-management/" },
  { label: "RFC 7489: DMARC", url: "https://datatracker.ietf.org/doc/html/rfc7489" },
];
