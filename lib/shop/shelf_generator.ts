// C5 hop 3 generator: DrainEntry -> Shelf. Default path is the SYNTHETIC expansion in generator.ts (no model call, no key, no network).
// A model port may be injected later (real model-backed generator is PENDING LIVE); whatever it returns is forced synthetic until a live gate says otherwise.
// Never publishes: the Shelf is handed to the grader and nothing else. visibleShelves in grader.ts stays the only door.
import type { Shelf, GeneratorConfig } from "./types";
import type { DrainEntry, ShelfGenerator } from "./drain";
import { expandSynthetic, validateConfig } from "./generator.ts";
import { shelfFromConfig } from "./catalogue.ts";

export interface ModelPort { configFor(entry: DrainEntry): GeneratorConfig }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const POOL = expandSynthetic(9999);

// Deterministic: the same cluster_id always picks the same synthetic config, with the cluster id baked into the shelf id.
function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
export function syntheticConfigFor(e: DrainEntry): GeneratorConfig {
  const base = POOL[hash(e.cluster_id) % POOL.length];
  const id = slug(`${base.id}-${e.cluster_id}`) || base.id;
  return { ...base, id, name: `${base.name} [synthetic: ${e.label}]`.slice(0, 120), synthetic: true };
}

export class SyntheticShelfGenerator implements ShelfGenerator {
  private readonly model?: ModelPort;
  constructor(model?: ModelPort) { this.model = model; }
  generate(e: DrainEntry): Shelf {
    const cfg = this.model ? this.model.configFor(e) : syntheticConfigFor(e);
    const errs = validateConfig(cfg);
    if (errs.length) throw new Error("invalid generator config: " + errs.join("; "));
    const shelf = shelfFromConfig({ ...cfg, synthetic: true });
    return { ...shelf, synthetic: true };
  }
}
