// Browser loader for the concierge. The catalogue (portal shelves + every real offer) is NOT imported here: it is fetched
// as JSON on first use, so it never lands in a route's first-load JS. Do not import ./catalogue.ts from app/ or components/
// (scripts/test_concierge_lazy.mjs fails the build if you do). Zero model calls; the log adapter is the no-op.
import { buildIndex, concierge, NoopLog } from "./router.ts";
import type { UnmatchedLog } from "./router.ts";
import type { Reply, Seat, Shelf } from "./types.ts";

export const SHELVES_URL = "/concierge/shelves.json";
export type Ask = (q: string, seat?: Seat) => Promise<Reply>;

export async function loadAsk(fetchFn: typeof fetch = fetch, log: UnmatchedLog = new NoopLog()): Promise<Ask> {
  const res = await fetchFn(SHELVES_URL);
  if (!res.ok) throw new Error("catalogue unavailable: " + res.status);
  const shelves = (await res.json()) as Shelf[];
  return concierge(buildIndex(shelves), log);
}
