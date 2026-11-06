// C6 concierge types. Code-only router: no model call, no network, no clock, no randomness.
export type Seat = "guest" | "owner" | "pro" | "agent" | "enterprise" | "partner";
export const SEATS: Seat[] = ["guest", "owner", "pro", "agent", "enterprise", "partner"];

export type Shelf = {
  id: string;                 // "portal:scan" | "offer:<slug>"
  kind: "portal" | "offer";
  title: string;
  href: string;
  home: Seat[];               // seats this shelf belongs to (router boosts these)
  only?: Seat[];              // if set, the shelf is eligible for these seats only (a seat's own dashboard)
  keywords: string[];         // phrases people actually type
  text: string;               // name + bluf, lower weight
  availability: "LIVE" | "PLANNED" | "READY" | "NOT_YET_OPEN";
  priceAud: number | null;
  cadence: string;
  answer: string;             // the only thing the concierge may say about this shelf
};

export type Tap = { label: string; shelfId: string; href: string };

export type Reply =
  | { kind: "match"; shelf: Shelf; score: number; margin: number; answer: string; slots: Record<string, string>; alternatives: Tap[]; seatNote?: string }
  | { kind: "ask"; question: string; taps: Tap[]; score: number }
  | { kind: "unmatched"; message: string; configStub: ConfigStub };

export type ConfigStub = { ask: string; normalised: string; seat: Seat; status: "LOGGED_FOR_GENERATOR"; quote: null };
