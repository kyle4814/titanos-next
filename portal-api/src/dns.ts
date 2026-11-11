// Domain ownership by DNS TXT. A buyer proves control of a domain by publishing a token we issued.
export function normaliseDomain(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let d = input.trim().toLowerCase().replace(/\.$/, "");
  d = d.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (d.length > 253 || !d.includes(".")) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(d) || d.includes(":")) return null; // IPs are not domains
  const labels = d.split(".");
  if (!labels.every((l) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(l))) return null;
  if (!/^[a-z]{2,}$/.test(labels[labels.length - 1])) return null;
  if (["localhost", "local", "internal", "test", "invalid", "example"].includes(labels[labels.length - 1])) return null;
  return d;
}
export const verifyRecordName = (domain: string) => `_titanos-verify.${domain}`;
export const verifyRecordValue = (token: string) => `titanos-verify=${token}`;

export interface TxtResolver { txt(name: string): Promise<string[]> }

// DNS-over-HTTPS resolver (Cloudflare JSON API). Passive and public, the only lookup this file ever makes.
// Fails closed: a stalled endpoint rejects after timeoutMs (default 3000), so verify answers 502, never hangs.
export const DOH_TIMEOUT_MS = 3000;
export function dohResolver(fetchFn: typeof fetch = fetch, opts: { timeoutMs?: number } = {}): TxtResolver {
  const timeoutMs = opts.timeoutMs ?? DOH_TIMEOUT_MS;
  return {
    async txt(name) {
      const ctl = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, rej) => { timer = setTimeout(() => { ctl.abort(); rej(new Error("doh_timeout")); }, timeoutMs); });
      const work = (async () => {
        const r = await fetchFn(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`, { headers: { accept: "application/dns-json" }, signal: ctl.signal });
        if (!r.ok) throw new Error(`doh_${r.status}`);
        const j = (await r.json()) as { Answer?: { type: number; data: string }[] };
        return (j.Answer ?? []).filter((a) => a.type === 16).map((a) => a.data.replace(/^"|"$/g, "").replace(/" "/g, ""));
      })();
      work.catch(() => {}); // a late rejection after the deadline must not surface as unhandled
      try { return await Promise.race([work, deadline]); } finally { clearTimeout(timer); }
    },
  };
}
// Test double: a map of name -> TXT values.
export function fakeResolver(zone: Record<string, string[]>): TxtResolver & { zone: Record<string, string[]> } {
  return { zone, async txt(name) { return zone[name] ?? []; } };
}
