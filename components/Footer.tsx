"use client";

/**
 * Footer: the one site-wide footer. Since the 2026-11-28 obsidian and gold redesign every route renders
 * HomeFooter (components/home-redesign/HomeFooter.tsx); it carries the merged link set of the old footer
 * (Services, Proof, Company) plus an "All pages" disclosure fed by lib/navLinks.ts.
 */
import HomeFooter from "./home-redesign/HomeFooter";

export default function Footer() {
  return <HomeFooter />;
}
