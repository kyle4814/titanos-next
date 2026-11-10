// Per-key spend caps in credits (1 credit = AU$0.01, EXAMPLE rate). A key with no stored cap gets these, never unlimited.
export const DEFAULT_KEY_CAP_DAILY = 500;   // AU$5.00 a UTC day
export const DEFAULT_KEY_CAP_TOTAL = 2000;  // AU$20.00 over the key's life
export const MAX_KEY_CAP_DAILY = 100_000;
export const MAX_KEY_CAP_TOTAL = 1_000_000;
export const DAY_MS = 86_400_000;
export const dayStartOf = (t: number) => Math.floor(t / DAY_MS) * DAY_MS;
export const capsOf = (k: { capDaily?: number; capTotal?: number }) => ({ capDaily: k.capDaily ?? DEFAULT_KEY_CAP_DAILY, capTotal: k.capTotal ?? DEFAULT_KEY_CAP_TOTAL });
