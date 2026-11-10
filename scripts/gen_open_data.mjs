// Writes the open datasets (public/data/*) from the site's own data files. `--check` fails if the committed files differ
// from a fresh generation, so a dataset can never be hand-edited away from its source.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
const root = new URL("../", import.meta.url);
const R = (p) => JSON.parse(readFileSync(new URL(p, root), "utf8"));
const meta = R("lib/site-data/opendata.json");
const sectors = R("lib/site-data/sectors.json");
const proof = R("lib/site-data/proof.json");

const csvCell = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCsv = (cols, rows) => [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n";

const sectorRows = sectors.map((s) => ({
  slug: s.slug, name: s.name, point: s.point, problem: s.problem,
  value: s.fact.value, label: s.fact.label, note: s.fact.note, source: s.fact.source ?? "", source_url: s.fact.sourceUrl ?? "",
}));
const claimRows = proof.stars.map((s) => ({ id: s.id, group: s.group, display: s.display, caption: s.caption, label: s.label, system: s.system, source: s.source, date: s.date, method: s.method }));

const out = {
  "public/data/sector-index.json": JSON.stringify({ dataset: "Sector Index", compiled: meta.compiled, system: meta.system, licence: meta.licence, rows: sectorRows }, null, 1) + "\n",
  "public/data/sector-index.csv": toCsv(Object.keys(sectorRows[0]), sectorRows),
  "public/data/claims-ledger.json": JSON.stringify({ dataset: "Claims ledger", compiled: meta.compiled, system: meta.system, licence: meta.licence, labels: proof.labels, rows: claimRows }, null, 1) + "\n",
  "public/data/claims-ledger.csv": toCsv(Object.keys(claimRows[0]), claimRows),
};

if (process.argv.includes("--check")) {
  let bad = 0;
  for (const [p, c] of Object.entries(out)) {
    const f = new URL(p, root);
    if (!existsSync(f) || readFileSync(f, "utf8") !== c) { console.log("STALE " + p); bad++; }
  }
  process.exit(bad ? 1 : 0);
}
mkdirSync(new URL("public/data/", root), { recursive: true });
for (const [p, c] of Object.entries(out)) writeFileSync(new URL(p, root), c);
console.log("wrote " + Object.keys(out).join(", "));
