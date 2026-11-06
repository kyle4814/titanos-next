const ROOT = new URL("../../../", import.meta.url).pathname; 
const { gradeShelf, visibleShelves, gradeAll } = await import("../../../lib/shop/grader.ts");
const fs = (await import("node:fs")).default;
const base = JSON.parse(fs.readFileSync(ROOT + "lib/shop/shelves.json","utf8")).shelves[0];
const muts = {
  "forged pass flag on bad slug": { ...base, slug: "Bad Slug!", grade: { pass: true, checks: [] } },
  "no grade field": (({ grade, ...r }) => r)(base),
  "price w/o PUBLISHED": { ...base, priceLabel: "MODELLED" },
  "negative price": { ...base, priceAud: -5 },
  "buyUrl http non-stripe": { ...base, buyUrl: "https://evil.example/pay" },
  "buyUrl stripe lookalike": { ...base, buyUrl: "https://buy.stripe.com.evil.example/x" },
  "status BUILD but BUYABLE": { ...base, status: "BUILD" },
  "NaN price": { ...base, priceAud: NaN },
  "Infinity price": { ...base, priceAud: Infinity },
  "string price": { ...base, priceAud: "49" },
  "-Infinity price": { ...base, priceAud: -Infinity },
  "object price": { ...base, priceAud: {} },
  "string price on a QUOTE shelf": { ...base, availability: "QUOTE", cadence: "quote", priceLabel: "QUOTE", buyUrl: null, priceAud: "49" },
  "BUYABLE at price 0": { ...base, priceAud: 0 },
  "dash in faq": { ...base, faq: [{ q: "a", a: "x — y" }] },
  "tell word in bullet": { ...base, bullets: ["Seamlessly leverage the landscape"] },
  "html in name": { ...base, name: "<script>alert(1)</script>" },
  "synthetic": { ...base, synthetic: true },
};
for (const [k, v] of Object.entries(muts)) { let shown; try { const g = gradeAll([v]); shown = visibleShelves(g.map((x) => ({ ...x, grade: v.grade ?? x.grade }))).length; } catch (e) { shown = "THROWS " + e.message; } console.log(k.padEnd(32), "shown:", shown); }
