// Structured-data lane tests (source level, no build needed).
// Checks the builders in lib/jsonld.ts emit valid, parseable JSON-LD of the right types, that the product
// pages wire Product + Offer (AUD, price from lib/products), FAQPage and BreadcrumbList, and that
// Organization is a ProfessionalService with a Brisbane locality and no street address.
// Run: node --import ./scripts/alias_loader.mjs --experimental-strip-types --no-warnings scripts/test_schema_jsonld.mjs
import fs from "node:fs";
import { organization, website, product, breadcrumbs, itemList, faqPage, article, serialise } from "../lib/jsonld.ts";
import { PRODUCTS } from "../lib/products/products.ts";

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error("FAIL", m); } else console.log("ok  ", m); };
const roundTrip = (o) => JSON.parse(serialise(o));

const org = roundTrip(organization());
ok([].concat(org["@type"]).includes("Organization") && [].concat(org["@type"]).includes("ProfessionalService"), "Organization is also a ProfessionalService");
ok(org.address.addressLocality === "Brisbane" && !("streetAddress" in org.address) && !("postalCode" in org.address), "Brisbane locality, no street address");
ok(roundTrip(website())["@type"] === "WebSite", "WebSite parses");

const bc = roundTrip(breadcrumbs([{ name: "Home", path: "/" }, { name: "A", path: "/a" }, { name: "B", path: "/a/b" }]));
ok(bc.itemListElement.map((i) => i.position).join() === "1,2,3" && bc.itemListElement[2].item === "https://titanos.tech/a/b", "BreadcrumbList positions and absolute URLs");

const priced = roundTrip(product({ path: "/products/x", name: "X", description: "d", priceAud: 49, buyable: true }));
ok(priced.offers.priceCurrency === "AUD" && priced.offers.price === 49 && priced.offers.availability.endsWith("InStock"), "buyable product: AUD Offer InStock");
const pre = roundTrip(product({ path: "/products/x", name: "X", description: "d", priceAud: 49, buyable: false, preOrder: true }));
ok(pre.offers.availability.endsWith("PreOrder") && pre.offers.price === 49, "not-yet-live product: Offer is PreOrder, never InStock");
ok(!("offers" in roundTrip(product({ path: "/p", name: "X", description: "d", priceAud: 49, buyable: false }))), "described-only product has no Offer");
ok(!("offers" in roundTrip(product({ path: "/p", name: "X", description: "d", priceAud: null, buyable: true, preOrder: true }))), "no price, no Offer");

ok(faqPage([]) === null && itemList([]) === null, "empty FAQ and empty list emit nothing");
ok(roundTrip(faqPage([{ q: "Q", a: "A" }]))["@type"] === "FAQPage", "FAQPage parses");
ok(roundTrip(article({ path: "/blog/x", headline: "H", description: "D", datePublished: "2026-11-01" })).publisher["@id"].endsWith("#organization"), "Article links to the Organization");
const il = roundTrip(itemList(PRODUCTS.map((p) => ({ name: p.name, path: `/products/${p.slug}` }))));
ok(il.itemListElement.length === PRODUCTS.length, "ItemList covers every product");
ok(!serialise({ a: "</script><b>" }).includes("</script>"), "serialise escapes script-closing sequences");

// every product has a price from products.ts that the Offer would carry
for (const p of PRODUCTS) ok(Number.isFinite(p.suggestedPriceAud) && p.suggestedPriceAud > 0, `${p.slug}: products.ts price AU$${p.suggestedPriceAud}`);

// page wiring (source)
const pp = fs.readFileSync("app/products/[slug]/page.tsx", "utf8");
for (const needle of ["product({", "faqPage(p.faq)", "breadcrumbs([", "productPriceAud(p)"]) ok(pp.includes(needle), `products/[slug] uses ${needle}`);
const pi = fs.readFileSync("app/products/page.tsx", "utf8");
ok(pi.includes("itemList(") && pi.includes("breadcrumbs(["), "products index emits ItemList and BreadcrumbList");
const blog = fs.readFileSync("app/blog/[slug]/page.tsx", "utf8");
ok(!blog.includes('"@type": "BreadcrumbList"') && blog.includes("breadcrumbs(["), "blog posts use the shared breadcrumbs builder");

// no em or en dashes in emitted strings
ok(!/[–—]/.test(JSON.stringify([org, bc, il])), "no em or en dashes in emitted JSON-LD");

console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
