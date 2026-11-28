// Pluggable file storage. The service only needs `get(key) -> { body, size }` (the R2Like shape), so R2 can come back with no
// service change: bind DIGITAL_BUCKET and storageFor() prefers it. Until R2 is enabled the zips live in Workers KV (values up to 25 MiB).
import type { Env, KVLike, R2Like } from "./env.ts";

// The catalogue key is products/<slug>/<slug>.zip (R2 layout). KV stores the same file at products/<slug>.zip.
export function kvKey(catalogueKey: string): string {
  const m = /^products\/([^/]+)\/\1\.zip$/.exec(catalogueKey);
  return m ? `products/${m[1]}.zip` : catalogueKey;
}

export class KvStorage implements R2Like {
  private kv: KVLike;
  constructor(kv: KVLike) { this.kv = kv; }
  async get(key: string) {
    const buf = await this.kv.get(kvKey(key), "arrayBuffer");
    if (!buf) return null;
    return { body: new Response(buf).body, size: buf.byteLength };
  }
}

export function storageFor(env: Env): R2Like | undefined {
  if (env.DIGITAL_BUCKET) return env.DIGITAL_BUCKET;
  if (env.DIGITAL_FILES) return new KvStorage(env.DIGITAL_FILES);
  return undefined;
}
