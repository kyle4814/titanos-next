"use client";

/**
 * PageMood — sets <body data-page="..."> based on the current route so
 * globals.css per-page accent shards (--accent / --card) can swap. Pure
 * side-effect component, returns null.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function PageMood() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof document === "undefined") return;
    const slug = (pathname ?? "/").replace(/^\//, "").split("/")[0] || "home";
    document.body.dataset.page = slug;
  }, [pathname]);
  return null;
}
