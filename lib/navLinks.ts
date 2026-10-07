/**
 * Navigation data — single source of truth for the drawer (mobile), the
 * desktop strip and the desktop "More" menu.
 *
 * MORE_LINKS is DERIVED: every LINKS entry that is neither on the desktop
 * strip nor the CTA. Add a page to LINKS and it appears in More on desktop
 * automatically, so desktop and mobile cannot drift.
 * scripts/test_nav_links.mjs fails if any LINKS href is unreachable.
 * Keep this file free of imports so the node test can load it directly.
 */

export type NavItem = { label: string; href: string; external: boolean };

// Drawer (mobile) shows every door. Offers and the finder lead.
export const LINKS: NavItem[] = [
  { label: "Find your offer", href: "/find", external: false },
  { label: "All offers", href: "/offers", external: false },
  { label: "Case studies", href: "/case-studies", external: false },
  { label: "Free consultation", href: "/audit", external: false },
  { label: "AI Partnership", href: "/ai-delivery", external: false },
  { label: "Compliance", href: "/compliance", external: false },
  { label: "Monitor", href: "/monitor", external: false },
  { label: "Blog", href: "/blog", external: false },
  { label: "Black Ice", href: "/black-ice", external: false },
  { label: "Leads", href: "/leads", external: false },
  { label: "Free Scan", href: "/scan", external: false },
  { label: "Evidence Pack", href: "/our-evidence-pack", external: false },
  { label: "Refer & Earn", href: "/refer", external: false },
  { label: "Methodology", href: "/methodology", external: false },
  { label: "Costs", href: "/costs", external: false },
  { label: "Speed", href: "/speed", external: false },
  { label: "Proof", href: "/proof", external: false },
  { label: "About", href: "/about", external: false },
  { label: "Contact", href: "/contact", external: false },
];

// Desktop strip: short labels, one line. Everything else lives in More.
export const DESKTOP_LINKS: NavItem[] = [
  { label: "Find offer", href: "/find", external: false },
  { label: "Offers", href: "/offers", external: false },
  { label: "Cases", href: "/case-studies", external: false },
  { label: "AI", href: "/ai-delivery", external: false },
  { label: "Compliance", href: "/compliance", external: false },
  { label: "Monitor", href: "/monitor", external: false },
  { label: "Blog", href: "/blog", external: false },
  { label: "About", href: "/about", external: false },
];

// The gold CTA on desktop stands in for these LINKS hrefs.
export const CTA_HREFS: string[] = ["/audit"];

export const MORE_LINKS: NavItem[] = LINKS.filter(
  (l) =>
    !DESKTOP_LINKS.some((d) => d.href === l.href) && !CTA_HREFS.includes(l.href),
);

// Presentation only: group and one-line description per href. A href not
// listed here still renders, under "More", so the derivation stays total.
const META: Record<string, { group: string; blurb: string }> = {
  "/scan": { group: "Tools", blurb: "Free email security check" },
  "/our-evidence-pack": { group: "Tools", blurb: "What a TITANOS report looks like" },
  "/leads": { group: "Tools", blurb: "Verified local leads" },
  "/black-ice": { group: "Company", blurb: "How we work, calm and exact" },
  "/methodology": { group: "Company", blurb: "How every figure is sourced" },
  "/costs": { group: "Company", blurb: "Every price, every cost, all the maths" },
  "/proof": { group: "Company", blurb: "Public code, test logs, a replayable build" },
  "/speed": { group: "Company", blurb: "Fast because it is code, precise because it is checked" },
  "/refer": { group: "Company", blurb: "Introduce a business, get rewarded" },
  "/contact": { group: "Company", blurb: "Talk to Kyle directly" },
};
const GROUP_ORDER = ["Tools", "Company", "More"];

export type MoreGroup = { title: string; items: (NavItem & { blurb?: string })[] };

export function groupMore(items: NavItem[] = MORE_LINKS): MoreGroup[] {
  const groups: MoreGroup[] = GROUP_ORDER.map((title) => ({ title, items: [] }));
  for (const it of items) {
    const m = META[it.href];
    const g = groups.find((x) => x.title === (m?.group ?? "More"))!;
    g.items.push({ ...it, blurb: m?.blurb });
  }
  return groups.filter((g) => g.items.length > 0);
}
