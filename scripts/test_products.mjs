// Digital product catalogue gate. Run via `npm test`.
// Regression targets (all fail on the old code, where lib/products and app/products do not exist):
//  - at least 10 products and 2 courses; courses carry outline + lessons + bundle
//  - price only from offers.json via offerSlug, else TBC (no hardcoded prices)
//  - payment-link data file exists, every slug present, links empty or https only
//  - no em/en dashes, no dollar-digit literals, no AI-tell words in any copy
//  - pages exist for the catalogue and per product
import { PRODUCTS } from "../lib/products/products.ts";
import offers from "../lib/offers/offers.json" with { type: "json" };
import links from "../lib/products/links.json" with { type: "json" };
import { existsSync, readFileSync } from "node:fs";

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };

const courses = PRODUCTS.filter((p) => p.kind === "course");
ok(PRODUCTS.length - courses.length >= 10, `at least 10 products (${PRODUCTS.length - courses.length})`);
ok(courses.length >= 2, `at least 2 courses (${courses.length})`);
ok(new Set(PRODUCTS.map((p) => p.slug)).size === PRODUCTS.length, "slugs unique");
ok(courses.every((c) => c.outline?.length >= 3 && c.outline.every((m) => m.lessons.length >= 2) && c.bundle?.length >= 5),
  "every course has outline, lessons and a delivery bundle");
ok(PRODUCTS.every((p) => p.delivery?.file && p.forWho.length && p.youGet.length && p.bluf), "every product has who, what, delivery file");
ok(PRODUCTS.every((p) => !p.offerSlug || offers.some((o) => o.slug === p.offerSlug)), "offerSlug resolves in offers.json");
ok(PRODUCTS.every((p) => !("priceAud" in p)), "no hardcoded priceAud on a product (price is offers.json or TBC)");
ok(PRODUCTS.every((p) => p.suggestedPriceAud > 0), "suggested prices set for the Stripe card");
ok(PRODUCTS.every((p) => p.slug in links), "links.json has a key per product");
ok(Object.values(links).every((v) => v === "" || v.startsWith("https://buy.stripe.com/")), "links are empty or https Stripe links");

const text = JSON.stringify(PRODUCTS) + ["app/products/page.tsx", "app/products/[slug]/page.tsx"].map((f) => existsSync(f) ? readFileSync(f, "utf8") : "").join("\n");
ok(!/[—–]/.test(text), "no em or en dashes");
ok(!/\$\s?[0-9]/.test(text), "no hardcoded dollar figures");
ok(!/\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|synerg\w*)\b/i.test(text), "no AI-tell words");
ok(!/in today'?s|let'?s dive|game[- ]changer|elevate your|whether you'?re a/i.test(text), "no AI-tell phrases");
ok(existsSync("app/products/page.tsx") && existsSync("app/products/[slug]/page.tsx"), "catalogue and product pages exist");
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
