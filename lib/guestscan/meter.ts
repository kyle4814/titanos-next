// The guest-scan call meter. Every outbound request on the guest-scan path goes
// through ONE wrapper (meteredFetch). It records the host of each request and
// classifies it against lib/modelhosts.ts, so ScanResult.modelCalls is a
// measurement, not a literal.
import { isModelHost } from "../modelhosts.ts";

export class RequestMeter {
  total = 0;
  modelCalls = 0;
  readonly log: string[] = []; // every request's host, in order
  modelHosts: string[] = [];
  record(host: string): void {
    const h = String(host).toLowerCase();
    this.total++;
    this.log.push(h);
    if (isModelHost(h)) { this.modelCalls++; if (!this.modelHosts.includes(h)) this.modelHosts.push(h); }
  }
  snapshot(): { total: number; modelCalls: number; at: number } { return { total: this.total, modelCalls: this.modelCalls, at: this.log.length }; }
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

// The single counting wrapper. The host is read from the URL BEFORE the request leaves,
// so a call that fails or times out still counts as a call attempted.
export function meteredFetch(meter: RequestMeter, impl: FetchLike = (u, i) => fetch(u, i)): FetchLike {
  return (url, init) => {
    let host = "";
    try { host = new URL(String(url)).host; } catch { host = "unparseable"; }
    meter.record(host);
    return impl(url, init);
  };
}
