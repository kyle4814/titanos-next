// The Ariance hero case study. Every figure the page shows comes from ariance.json (or is computed
// from it here), so the page can never drift from its sources. Null fields render nothing.
// client_consent=false keeps the page noindex and off every list until Kyle flips it.
import data from "./ariance.json";

export type Phase = {
  id: string;
  label: string;
  started: string | null;
  finished: string | null;
  commit: string;
  committed: string;
};

type Data = typeof data;
// JSON null fields infer as `never`; widen the ones that are filled in later.
export type ArianceData = Omit<Data, "speed" | "quality" | "cost" | "client_words"> & {
  speed: Omit<Data["speed"], "brief_received_at" | "phases"> & { brief_received_at: string | null; phases: Phase[] };
  quality: Omit<Data["quality"], "findings_delivered_at" | "tests"> & {
    findings_delivered_at: string | null;
    tests: Omit<Data["quality"]["tests"], "total_after_merge"> & { total_after_merge: number | null };
  };
  cost: Omit<Data["cost"], "build_cost_usd" | "hosting_limits" | "live_url"> & {
    build_cost_usd: number | null;
    hosting_limits: string | null;
    live_url: string | null;
  };
  client_words: { heading: string; quote: string | null; attribution: string | null };
};
export const ARIANCE = data as unknown as ArianceData;
export const arianceVisible: boolean = data.client_consent === true;
export const ariancePath = "/case-studies/ariance";

const MIN = 60_000;

/** "17 min 14 s" style duration between two ISO timestamps; null if either is missing. */
export function between(a: string | null, b: string | null): string | null {
  if (!a || !b) return null;
  const ms = Date.parse(b) - Date.parse(a);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const m = Math.floor(ms / MIN);
  const s = Math.round((ms % MIN) / 1000);
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

/** Brisbane wall-clock time, e.g. "11:46:47". The strings carry an explicit +10:00 offset. */
export function clock(iso: string): string {
  return iso.slice(11, 19);
}
