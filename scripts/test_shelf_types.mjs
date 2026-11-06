// F-C5 regression: the shelf grader type-checks every field that reaches rendering. Synthetic fixtures derived from a real shelf.
import fs from "node:fs";
import { gradeShelf, gradeAll, visibleShelves, isValidPrice } from "../lib/shop/grader.ts";

let pass = 0, fail = 0;
const t = (name, ok, extra = "") => { if (ok) pass++; else { fail++; console.log("FAIL " + name + " " + extra); } };
const root = new URL("..", import.meta.url).pathname;
const file = JSON.parse(fs.readFileSync(root + "lib/shop/shelves.json", "utf8"));
const base = file.shelves.find((s) => s.availability === "BUYABLE" && s.priceAud > 0);
const hidden = (patch) => { const s = { ...base, ...patch }; return visibleShelves([{ ...s, grade: { pass: true, checks: [] } }]).length === 0 && !gradeShelf(s).pass; };

// 1. Bad prices are hidden (a forged pass flag does not help).
const badPrices = { Infinity: Infinity, "-Infinity": -Infinity, NaN: NaN, 'string "49"': "49", null: null, true: true, false: false, object: { v: 49 }, array: [49], "1e309": 1e309, negative: -1, "-0.01": -0.01, "sub-cent": 49.001, "unsafe cents": 1e17 };
for (const [label, v] of Object.entries(badPrices)) t(`price ${label} hidden`, hidden({ priceAud: v }));
// non-BUYABLE paths must not let a bad price through either (FREE_STEP / QUOTE with a corrupt price)
for (const [label, v] of Object.entries({ Infinity, str: "0", NaN, neg: -5 })) {
  t(`free step with price ${label} hidden`, hidden({ availability: "FREE_STEP", buyUrl: null, cadence: "none", priceLabel: "UNKNOWN", priceAud: v }));
  t(`quote with price ${label} hidden`, hidden({ availability: "QUOTE", buyUrl: null, cadence: "quote", priceLabel: "QUOTE", priceAud: v }));
}
t("valid price shows", visibleShelves(gradeAll([base])).length === 1);
t("valid 0 price free shelf passes type check", isValidPrice(0) && isValidPrice(49.99) && isValidPrice(5997));
t("isValidPrice rejects the lot", [Infinity, -Infinity, NaN, "49", null, undefined, true, {}, [], 1e309, -1].every((v) => !isValidPrice(v)));

// 2. Other types.
for (const [label, v] of Object.entries({ number: 5, null: null, array: ["x"], object: { a: 1 }, undefined: undefined })) t(`title ${label} hidden`, hidden({ name: v }));
for (const [label, v] of Object.entries({ string: "a,b", null: null, object: { a: 1 }, undefined: undefined, "array with number": [1], "array with object": [{}] })) t(`tags ${label} hidden`, hidden({ tags: v }));
for (const [label, v] of Object.entries({ string: "x", null: null, "bullet number": [1], undefined: undefined })) t(`bullets ${label} hidden`, hidden({ bullets: v }));
t("faq entry with non-string answer hidden", hidden({ faq: [{ q: "q?", a: 5 }] }));
t("bluf number hidden", hidden({ bluf: 12345678901234567890 }));
t("shelf null does not throw and is hidden", !gradeShelf(null).pass && !gradeShelf(undefined).pass && !gradeShelf("x").pass);

// 3. Unknown fields hidden (each could reach rendering).
for (const k of ["html", "dangerouslySetInnerHTML", "onClick", "__proto__x", "extra"]) t(`unknown field ${k} hidden`, hidden({ [k]: "<img src=x onerror=alert(1)>" }));
t("known optional proof key still allowed on generators", !gradeShelf({ ...base, proof: { fixture: "f", passed: true } }).checks.find((c) => c.id === "no-unknown-fields").ok === false);

// 4. Counts: the committed shelves.json still has 30 shown of 115 and 0 ungraded.
const all = gradeAll(file.shelves);
t("committed shown shelves all still pass", file.shelves.length === 30 && all.every((s) => s.grade.pass), `${file.shelves.length}`);
t("counts: 115 total, 30 shown, 0 ungraded", file.counts.total === 115 && file.counts.graded_pass === 30 && file.counts.ungraded_shown === 0, JSON.stringify(file.counts));
t("ungraded count 0", visibleShelves(file.shelves.map((s) => ({ ...s, grade: undefined }))).length === 0);

console.log(fail ? `FAIL ${fail} (pass ${pass})` : `ALL PASS ${pass}`);
process.exit(fail ? 1 : 0);
