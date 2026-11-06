// TEST-ONLY. Makes 1,000 SYNTHETIC generator configs (synthetic:true, never public) plus 20 deliberately malformed ones.
// Output goes outside the repo (default: os tmpdir). It must never be written to lib/shop/generator_configs.json.
// Usage: node scripts/gen_synthetic_shelf_configs.mjs <outfile> [count=1000]
import { writeFileSync } from "node:fs";
import { JOBS, SECTORS, COUNTRIES } from "../lib/shop/generator.ts";

export function makeSynthetic(n = 1000) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const job = JOBS[i % JOBS.length], sector = SECTORS[i % SECTORS.length], country = COUNTRIES[i % COUNTRIES.length];
    out.push({
      id: `syn-${job}-${sector}-${country.toLowerCase()}-${i}`, job, sector, country,
      name: `SYNTHETIC ${job.replace(/-/g, " ")} for ${sector} (${country}) ${i}`,
      bluf: `SYNTHETIC test shelf ${i}: a ready-made ${job.replace(/-/g, " ")} for ${sector} in ${country}.`,
      priceAud: null, synthetic: true, proof: { fixture: `fixture-${job}`, passed: true },
    });
  }
  return out;
}

// 20 malformed, each tagged with the reason the loader must give.
export function makeMalformed(valid) {
  const v = () => ({ ...valid[0] });
  const m = [];
  const add = (cfg, expect) => m.push({ cfg, expect });
  add(null, "not an object"); add("a string", "not an object"); add([1, 2], "not an object");
  add((({ name, ...r }) => r)(v()), "name missing");
  add((({ bluf, ...r }) => r)(v()), "bluf missing");
  add((({ id, ...r }) => r)(v()), "id must be kebab-case");
  add({ ...v(), id: "Bad ID" }, "id must be kebab-case");
  add({ ...v(), id: "" }, "id must be kebab-case");
  add({ ...v(), job: "" }, "job missing");
  add({ ...v(), sector: "   " }, "sector missing");
  add((({ country, ...r }) => r)(v()), "country missing");
  add((({ synthetic, ...r }) => r)(v()), "synthetic must be explicit");
  add({ ...v(), synthetic: "yes" }, "synthetic must be explicit");
  add({ ...v(), priceAud: -5 }, "priceAud invalid");
  add({ ...v(), priceAud: "free" }, "priceAud");
  add({ ...v(), name: 42 }, "name must be a string");
  add({ ...v(), proof: { fixture: 7, passed: true } }, "proof must be");
  add({ ...v(), proof: "ok" }, "proof must be");
  add({ ...valid[1] }, "duplicate id"); // same id as an accepted config
  add({ ...v(), id: valid[2].id, name: "dup of third" }, "duplicate id");
  return m;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outFile = process.argv[2];
  if (!outFile || /generator_configs\.json$/.test(outFile)) { console.error("give an output path outside lib/shop (never generator_configs.json)"); process.exit(2); }
  const n = Number(process.argv[3] || 1000);
  const valid = makeSynthetic(n);
  writeFileSync(outFile, JSON.stringify([...valid, ...makeMalformed(valid).map((x) => x.cfg)]));
  console.log(`wrote ${n} synthetic + 20 malformed to ${outFile}`);
}
