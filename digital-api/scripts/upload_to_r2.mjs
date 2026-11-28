// Push each built <slug>.zip to PRIVATE storage. Backend kv (default, R2 is not enabled): Workers KV key products/<slug>.zip.
// Backend r2: the PRIVATE R2 bucket under products/<slug>/<slug>.zip (the catalogue key). The Worker reads whichever is bound.
// DRY RUN BY DEFAULT: prints the plan and the exact wrangler commands, uploads nothing.
// Real upload needs BOTH --apply and DIGITAL_UPLOAD_CONFIRM=yes. Before uploading, each zip's
// sha256 and size are checked against digital-api/src/catalogue.generated.ts so a stale or half-built zip is never published.
// Usage: node digital-api/scripts/upload_to_r2.mjs [--dir <listings dir>] [--backend kv|r2] [--kv-id <namespace id>] [--bucket titanos-digital-products] [--apply]
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
export function kvKey(catalogueKey) { const m = /^products\/([^/]+)\/\1\.zip$/.exec(catalogueKey); return m ? `products/${m[1]}.zip` : catalogueKey; }
export function plan(items, dir, bucket, backend = "r2", kvId = "") {
  const rows = [], problems = [];
  for (const it of items) {
    const file = join(dir, it.slug, it.filename);
    if (!existsSync(file)) { problems.push(`${it.slug}: ${file} missing`); continue; }
    const buf = readFileSync(file);
    const sha = createHash("sha256").update(buf).digest("hex");
    if (statSync(file).size !== it.bytes || sha !== it.sha256) { problems.push(`${it.slug}: zip changed since the catalogue was generated (re-run scripts/gen_digital_catalogue.mjs)`); continue; }
    const args = backend === "kv"
      ? ["wrangler", "kv", "key", "put", kvKey(it.r2Key), "--path", file, "--namespace-id", kvId, "--remote"]
      : ["wrangler", "r2", "object", "put", `${bucket}/${it.r2Key}`, "--file", file, "--content-type", "application/zip", "--remote"];
    rows.push({ slug: it.slug, key: backend === "kv" ? kvKey(it.r2Key) : it.r2Key, file, args });
  }
  return { rows, problems };
}

function readKvId() { try { return /\[\[kv_namespaces\]\][^\[]*?id\s*=\s*"([0-9a-f]{32})"/.exec(readFileSync(join(HERE, "../wrangler.toml"), "utf8"))?.[1] ?? ""; } catch { return ""; } }

function main() {
  const argv = process.argv.slice(2);
  const val = (f, dflt) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : dflt; };
  const dir = resolve(val("--dir", process.env.DIGITAL_LISTINGS_DIR || DEFAULT_DIR));
  const bucket = val("--bucket", "titanos-digital-products");
  const apply = argv.includes("--apply");
  const backend = val("--backend", "kv");
  const kvId = val("--kv-id", readKvId());
  if (backend !== "kv" && backend !== "r2") { console.error("--backend must be kv or r2"); process.exit(2); }
  if (backend === "kv" && !kvId) { console.error("no KV namespace id (pass --kv-id or set it in wrangler.toml)"); process.exit(2); }
  const { rows, problems } = plan(readCatalogue(), dir, bucket, backend, kvId);
  for (const p of problems) console.error(`PROBLEM ${p}`);
  console.log(`${apply ? "APPLY" : "DRY RUN"}: ${rows.length} zip(s) -> ${backend === "kv" ? `kv:${kvId}/products/<slug>.zip` : `r2://${bucket}/products/<slug>/<slug>.zip`}`);
  for (const r of rows) console.log(`  ${r.slug}  npx ${r.args.join(" ")}`);
  if (!apply) { console.log("Dry run only. Nothing was uploaded."); process.exit(problems.length ? 1 : 0); }
  if (process.env.DIGITAL_UPLOAD_CONFIRM !== "yes") { console.error("Refusing: set DIGITAL_UPLOAD_CONFIRM=yes to upload for real."); process.exit(2); }
  if (problems.length) { console.error("Refusing: fix the problems above first."); process.exit(1); }
  for (const r of rows) {
    const out = spawnSync("npx", r.args, { stdio: "inherit", env: (({ CLOUDFLARE_API_TOKEN, ...e }) => e)(process.env) });   // args array, no shell
    if (out.status !== 0) { console.error(`upload failed for ${r.slug}`); process.exit(out.status ?? 1); }
  }
  console.log("Uploaded. Verify with a signed order download, or: npx wrangler kv key get <key> --namespace-id <id> --remote.");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
