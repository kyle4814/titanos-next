// Digital products catalogue generator. Ingests <dir>/*/listing.json (+ the built <slug>.zip) and writes the two derived files:
//   lib/shop/digital_products.json            what the static site reads (shelf-shaped entries, see lib/shop/digital_types.ts)
//   digital-api/src/catalogue.generated.ts    what the checkout Worker trusts for price and file (NEVER a client-sent price)
// Only a listing whose zip exists is listed (a product with no file is not buyable). Deterministic: same input, same bytes, so --check works.
// Usage: node scripts/gen_digital_catalogue.mjs [--dir <listings dir>] [--check] [--quiet]
//   DIGITAL_LISTINGS_DIR overrides the default directory. Reads only; writes only the two files above.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DIR = "/home/tech2/klinge-kernel/state/research/d89e1778/ocean/digital_products_2026-11-28";
export const SITE_OUT = join(ROOT, "lib/shop/digital_products.json");
export const WORKER_OUT = join(ROOT, "digital-api/src/catalogue.generated.ts");
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
export const R2_PREFIX = "products";

// Client copy rules (CT9): no em or en dashes in anything the site shows.
export const clean = (s) => String(s ?? "").replace(/\s*[—–]\s*/g, ", ").replace(/\s+/g, " ").trim();
const strList = (v) => (Array.isArray(v) ? v.map(clean).filter(Boolean) : []);

export function sha256File(p) { return createHash("sha256").update(readFileSync(p)).digest("hex"); }

// Returns { items, skipped } where each skipped carries a reason. Never throws on one bad listing.
export function ingest(dir) {
  const items = [], skipped = [];
  if (!existsSync(dir)) return { items, skipped: [{ slug: null, reason: `directory missing: ${dir}` }] };
  for (const name of readdirSync(dir).sort()) {
    const d = join(dir, name);
    if (!statSync(d).isDirectory()) continue;
    const lp = join(d, "listing.json");
    if (!existsSync(lp)) { skipped.push({ slug: name, reason: "no listing.json yet" }); continue; }
    let l;
    try { l = JSON.parse(readFileSync(lp, "utf8")); } catch { skipped.push({ slug: name, reason: "listing.json is not valid JSON (maybe mid-write)" }); continue; }
    const why = [];
    if (typeof l.slug !== "string" || !SLUG_RE.test(l.slug)) why.push("bad slug");
    else if (l.slug !== name) why.push("slug does not match its directory");
    if (!clean(l.title)) why.push("no title");
    if (!clean(l.tagline)) why.push("no tagline");
    if (typeof l.priceAud !== "number" || !Number.isFinite(l.priceAud) || l.priceAud < 1 || l.priceAud > 9999 || Math.round(l.priceAud * 100) !== l.priceAud * 100) why.push("priceAud must be a number from 1 to 9999 with at most 2 decimals");
    if (!clean(l.description)) why.push("no description");
    const zip = join(d, `${name}.zip`);
    if (!existsSync(zip)) why.push("zip not built yet");
    if (why.length) { skipped.push({ slug: name, reason: why.join("; ") }); continue; }
    const bytes = statSync(zip).size;
    if (bytes < 100) { skipped.push({ slug: name, reason: "zip is empty" }); continue; }
    items.push({
      slug: l.slug, title: clean(l.title), tagline: clean(l.tagline), description: clean(l.description), priceAud: l.priceAud,
      whatsIncluded: strList(l.whatsIncluded), whoItsFor: clean(l.whoItsFor), requirements: strList(l.requirements),
      deliveryFiles: strList(l.deliveryFiles).slice(0, 60), disclaimers: strList(l.disclaimers), zipBytes: bytes, zipSha256: sha256File(zip),
    });
  }
  items.sort((a, b) => a.slug.localeCompare(b.slug));
  return { items, skipped };
}

const fmtBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// A digital product as a shelf entry (lib/shop/types.ts Shelf shape) plus a `digital` block with the file facts.
export function toShelf(i) {
  return {
    id: `product:${i.slug}`, kind: "product", slug: i.slug, name: i.title, bluf: i.tagline,
    bullets: i.whatsIncluded.slice(0, 8),
    faq: [
      { q: "How do I get the files?", a: "Right after payment we email you a private download link. It works for 7 days and for up to 5 downloads. Nothing is posted and no account is needed." },
      { q: "What do I need to use it?", a: i.requirements.length ? i.requirements.map((r) => r.replace(/\.+$/, "")).join(". ") + "." : "Nothing beyond a computer that can open a zip file." },
      { q: "Who is it for?", a: i.whoItsFor || i.tagline },
    ],
    priceAud: i.priceAud, cadence: "one-off", priceLabel: "PUBLISHED", status: "READY", availability: "BUYABLE", buyUrl: null,
    href: `/shop/digital/${i.slug}`, source: `digital_products_2026-11-28/${i.slug}/listing.json`, synthetic: false, tags: ["digital"],
    digital: { description: i.description, whatsIncluded: i.whatsIncluded, requirements: i.requirements, deliveryFiles: i.deliveryFiles, disclaimers: i.disclaimers, filename: `${i.slug}.zip`, fileSize: fmtBytes(i.zipBytes), sha256: i.zipSha256 },
  };
}

export function renderSite(items) {
  return JSON.stringify({ generated_by: "scripts/gen_digital_catalogue.mjs", count: items.length, shelves: items.map(toShelf) }, null, 1) + "\n";
}
export function renderWorker(items) {
  const rows = items.map((i) => ({ slug: i.slug, title: i.title, priceCents: Math.round(i.priceAud * 100), r2Key: `${R2_PREFIX}/${i.slug}/${i.slug}.zip`, filename: `${i.slug}.zip`, bytes: i.zipBytes, sha256: i.zipSha256 }));
  return `// GENERATED by scripts/gen_digital_catalogue.mjs. Do not edit by hand: re-run the generator.\n// The checkout Worker takes the price from HERE and nowhere else.\nimport type { DigitalItem } from "./catalogue.ts";\nexport const GENERATED_ITEMS: DigitalItem[] = ${JSON.stringify(rows, null, 2)};\n`;
}

function main() {
  const argv = process.argv.slice(2);
  const di = argv.indexOf("--dir");
  const dir = di >= 0 ? resolve(argv[di + 1]) : process.env.DIGITAL_LISTINGS_DIR || DEFAULT_DIR;
  const check = argv.includes("--check"), quiet = argv.includes("--quiet");
  const { items, skipped } = ingest(dir);
  const site = renderSite(items), worker = renderWorker(items);
  if (check) {
    const same = existsSync(SITE_OUT) && existsSync(WORKER_OUT) && readFileSync(SITE_OUT, "utf8") === site && readFileSync(WORKER_OUT, "utf8") === worker;
    if (!same) { console.error("gen_digital_catalogue --check: generated files are stale, re-run node scripts/gen_digital_catalogue.mjs"); process.exit(1); }
    if (!quiet) console.log(`gen_digital_catalogue --check: up to date (${items.length} products)`);
    return;
  }
  writeFileSync(SITE_OUT, site); writeFileSync(WORKER_OUT, worker);
  if (!quiet) {
    console.log(`gen_digital_catalogue: ${items.length} listed, ${skipped.length} skipped (dir ${dir})`);
    for (const i of items) console.log(`  + ${i.slug}  AU$${i.priceAud}  ${fmtBytes(i.zipBytes)}`);
    for (const s of skipped) console.log(`  - ${s.slug ?? "(dir)"}: ${s.reason}`);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
