// The concierge catalogue for the browser: portal shelves plus the real offers, statically imported (no fs, no fetch).
import { PORTAL } from "./portal.ts";
import { shelfFromOffer } from "./offers.ts";
import type { OfferIn } from "./offers.ts";
import { buildIndex, concierge, NoopLog } from "./router.ts";
import type { UnmatchedLog } from "./router.ts";
import type { Shelf } from "./types.ts";
import { OFFERS_ENTERPRISE } from "../offers/data/enterprise.ts";
import { OFFERS_GOVERNMENT } from "../offers/data/government.ts";
import { OFFERS_MULTIPLIERS_A } from "../offers/data/multipliers-a.ts";
import { OFFERS_MULTIPLIERS_B } from "../offers/data/multipliers-b.ts";
import { OFFERS_SALES_SELFSERVE } from "../offers/data/sales-selfserve.ts";
import { OFFERS_SPECIALIST } from "../offers/data/specialist.ts";
import { OFFERS_TRADIES } from "../offers/data/tradies.ts";

const ALL_OFFERS = [...OFFERS_ENTERPRISE, ...OFFERS_GOVERNMENT, ...OFFERS_MULTIPLIERS_A, ...OFFERS_MULTIPLIERS_B, ...OFFERS_SALES_SELFSERVE, ...OFFERS_SPECIALIST, ...OFFERS_TRADIES] as unknown as OfferIn[];
export const SHELVES: Shelf[] = [...PORTAL, ...ALL_OFFERS.map(shelfFromOffer)];
export const INDEX = buildIndex(SHELVES);

// Zero model calls, zero network. The default adapter is a no-op that reports "not saved", so the widget never claims a log.
export function makeAsk(log: UnmatchedLog = new NoopLog()) { return concierge(INDEX, log); }
