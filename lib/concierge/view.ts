// Pure view model for the Concierge component: what to print and which links to offer. No React, no clock, no network.
import type { Reply } from "./types.ts";

export type View = { text: string; links: { label: string; href: string }[]; saved: boolean };
const OPEN = new Set(["LIVE", "READY"]);

export function viewOf(r: Reply): View {
  if (r.kind === "match") {
    const links = OPEN.has(r.shelf.availability) ? [{ label: r.shelf.title, href: r.shelf.href }] : [];
    const text = r.answer + (r.seatNote ? " " + r.seatNote : "") + (r.slots.domain ? " Your domain is ready to scan: " + r.slots.domain + "." : "");
    return { text, links, saved: false };
  }
  if (r.kind === "ask") return { text: r.question, links: r.taps.map((t) => ({ label: t.label, href: t.href })), saved: false };
  return { text: r.message, links: [{ label: "Contact a person", href: "/contact" }], saved: r.saved };
}
