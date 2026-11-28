// f310: per-tenant limit on estate refresh=1. Reuses the f204/f205 Throttle primitive (N admissions per window, then refused).
// Behind an interface so a shared-state (D1) adapter can replace the Memory one. Fails closed: no limiter wired = no refresh.
import { Throttle, MemoryThrottleStore, throttleKey } from "../throttle.ts";

export interface RefreshLimiter { allow(tenantId: string): Promise<boolean> }

/** UNKNOWN defaults: 3 refreshes per tenant per 10 minutes. Needs real traffic to tune. */
export const DEFAULT_REFRESH_MAX = 3, DEFAULT_REFRESH_WINDOW_MS = 10 * 60_000;

export class MemoryRefreshLimiter implements RefreshLimiter {
  private t: Throttle;
  constructor(now: () => number, max = DEFAULT_REFRESH_MAX, windowMs = DEFAULT_REFRESH_WINDOW_MS) {
    this.t = new Throttle({ maxFailures: max, windowMs, lockoutMs: windowMs, now }, new MemoryThrottleStore());
  }
  async allow(tenantId: string): Promise<boolean> {
    return (await this.t.reserveAsync(await throttleKey("estate-refresh", tenantId))).allowed;
  }
}
