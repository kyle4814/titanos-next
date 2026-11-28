"use client";

/**
 * Nav: the one site-wide header. Since the 2026-11-28 obsidian and gold redesign every route renders HomeNav
 * (components/home-redesign/HomeNav.tsx). Links come from lib/navLinks.ts (LINKS), so a page added there is
 * reachable from the desktop More menu and the mobile drawer; scripts/test_nav_links.mjs enforces it.
 */
import HomeNav from "./home-redesign/HomeNav";

export default function Nav() {
  return <HomeNav />;
}
