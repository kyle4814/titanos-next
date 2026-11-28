// Push each built <slug>.zip to the PRIVATE R2 bucket under products/<slug>/<slug>.zip (the key the Worker reads).
// DRY RUN BY DEFAULT: prints the plan and the exact wrangler commands, uploads nothing.
// Real upload needs BOTH --apply and DIGITAL_UPLOAD_CONFIRM=yes (a deliberate tap, runbook step 5). Before uploading, each zip's
// sha256 and size are checked against digital-api/src/catalogue.generated.ts so a stale or half-built zip is never published.
// Usage: node digital-api/scripts/upload_to_r2.mjs [--dir <listings dir>] [--bucket titanos-digital-products] [--apply]
// Credentials: wrangler's own login or CLOUDFLARE_API_TOKEN in the environment. Nothing is printed or stored here.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const GENERATED = join(HERE, "../src/catalogue.generated.ts");
const DEFAULT_DIR = "/home/tech2/klinge-kernel/state/research/d89e1778/ocean/digital_products_2026-11-28";

export function readCatalogue(path = GENERATED) {
  const t = readFileSync(path, "utf8");
  const m = /GENERATED_ITEMS: DigitalItem\[\] = (\[[\s\S]*\]);/.exec(t);
  if (!m) throw new Error("cannot read catalogue.generated.ts");
  return JSON.parse(m[1]);
}

// Pure planner: returns { rows, problems }. A row is uploadable only if its file exists and matches the catalogue hash and size.
export function plan(items, dir, bucket) {
  const rows = [], problems = [];
  for (const it of items) {
    const file = join(dir, it.slug, it.filename);
    if (!existsSync(file)) { problems.push(`${it.slug}: ${file} missing`); continue; }
    const buf = readFileSync(file);
    const sha = createHash("sha256").update(buf).digest("hex");
    if (statSync(file).size !== it.bytes || sha !== it.sha256) { problems.push(`${it.slug}: zip changed since the catalogue was generated (re-run scripts/gen_digital_catalogue.mjs)`); continue; }
    rows.push({ slug: it.slug, key: it.r2Key, file, args: ["wrangler", "r2", "object", "put", `${bucket}/${it.r2Key}`, "--file", file, "--content-type", "application/zip", "--remote"] });
  }
  return { rows, problems };
}

function main() {
  const argv = process.argv.slice(2);
  const val = (f, dflt) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : dflt; };
  const dir = resolve(val("--dir", process.env.DIGITAL_LISTINGS_DIR || DEFAULT_DIR));
  const bucket = val("--bucket", "titanos-digital-products");
  const apply = argv.includes("--apply");
  const { rows, problems } = plan(readCatalogue(), dir, bucket);
  for (const p of problems) console.error(`PROBLEM ${p}`);
  console.log(`${apply ? "APPLY" : "DRY RUN"}: ${rows.length} zip(s) -> r2://${bucket}/${"products/<slug>/<slug>.zip"}`);
  for (const r of rows) console.log(`  ${r.slug}  npx ${r.args.join(" ")}`);
  if (!apply) { console.log("Dry run only. Nothing was uploaded."); process.exit(problems.length ? 1 : 0); }
  if (process.env.DIGITAL_UPLOAD_CONFIRM !== "yes") { console.error("Refusing: set DIGITAL_UPLOAD_CONFIRM=yes to upload for real."); process.exit(2); }
  if (problems.length) { console.error("Refusing: fix the problems above first."); process.exit(1); }
  for (const r of rows) {
    const out = spawnSync("npx", r.args, { stdio: "inherit" });   // args array, no shell
    if (out.status !== 0) { console.error(`upload failed for ${r.slug}`); process.exit(out.status ?? 1); }
  }
  console.log("Uploaded. Verify with: npx wrangler r2 object get <bucket>/<key> --remote --file /dev/null (or the dashboard).");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
