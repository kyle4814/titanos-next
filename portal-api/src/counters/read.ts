// Reader: combines the store and the pure maths. Not mounted on any route.
import { COUNTER_MINUTES, EVENT_GET_FIXED, EVENT_SCAN, type CounterStore } from "./store.ts";
import { handRaiseRate, hoursLedger } from "./tally.ts";

export async function readSiteTally(store: CounterStore, fromMs?: number, toMs?: number) {
  const get = (n: string) => (fromMs !== undefined && toMs !== undefined ? store.window(n, fromMs, toMs) : store.read(n));
  const [scans, presses, minutes] = await Promise.all([get(EVENT_SCAN), get(EVENT_GET_FIXED), get(COUNTER_MINUTES)]);
  return { ledger: hoursLedger(scans, minutes), handRaise: handRaiseRate(Math.min(presses, scans), scans) };
}
