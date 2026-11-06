// C5 shop config loader: every raw config is accepted or rejected WITH a reason. Nothing is dropped silently, nothing crashes the build.
// Demonstrated bug (f33 probe): a config with a missing name crashed the grader, a null entry crashed shelfFromConfig,
// and a bad id was graded fail with no reason recorded. This loader sits in front of shelfFromConfig.
import type { GeneratorConfig } from "./types";
import { validateConfig } from "./generator.ts";

export type Rejected = { index: number; id: string | null; reasons: string[] };
export type Loaded = { accepted: GeneratorConfig[]; rejected: Rejected[]; total: number };

export function loadConfigs(raw: unknown): Loaded {
  const accepted: GeneratorConfig[] = [];
  const rejected: Rejected[] = [];
  if (!Array.isArray(raw)) return { accepted, rejected: [{ index: -1, id: null, reasons: ["config file must be a JSON array"] }], total: 0 };
  const seen = new Set<string>();
  raw.forEach((c, index) => {
    if (c === null || typeof c !== "object" || Array.isArray(c)) { rejected.push({ index, id: null, reasons: ["entry is not an object"] }); return; }
    const cfg = c as Partial<GeneratorConfig>;
    const reasons = validateConfig(cfg);
    for (const k of ["id", "job", "sector", "country", "name", "bluf"] as const) if (cfg[k] !== undefined && typeof cfg[k] !== "string") reasons.push(`${k} must be a string`);
    if (cfg.proof !== undefined && (typeof cfg.proof !== "object" || cfg.proof === null || typeof cfg.proof.fixture !== "string" || typeof cfg.proof.passed !== "boolean")) reasons.push("proof must be {fixture: string, passed: boolean}");
    if (typeof cfg.priceAud === "string" || typeof cfg.priceAud === "boolean") reasons.push("priceAud must be a number or null");
    if (typeof cfg.id === "string" && seen.has(cfg.id)) reasons.push("duplicate id");
    if (reasons.length) { rejected.push({ index, id: typeof cfg.id === "string" ? cfg.id : null, reasons }); return; }
    seen.add(cfg.id as string);
    accepted.push(cfg as GeneratorConfig);
  });
  return { accepted, rejected, total: raw.length };
}
