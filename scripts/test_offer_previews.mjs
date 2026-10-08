// Preview gate: every preview maps to a real offer, is labelled illustrative, and has no dashes, AI tells or fabricated-dollar literals.
import { PREVIEWS } from "../lib/offers/previews.ts";
import offers from "../lib/offers/offers.json" with { type: "json" };
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const keys = Object.keys(PREVIEWS);
ok(keys.length >= 10, `at least 10 previews (${keys.length})`);
ok(keys.every((k) => offers.some((o) => o.slug === k && o.status === "READY")), "every preview is a READY offer with a price in offers.json");
ok(keys.every((k) => /Illustrative sample/.test(PREVIEWS[k].caption)), "every preview is labelled an illustrative sample");
ok(keys.every((k) => PREVIEWS[k].rows.length >= 2 && PREVIEWS[k].rows.every((r) => r.length === PREVIEWS[k].head.length)), "rows match headers");
const text = JSON.stringify(PREVIEWS);
ok(!/[—–]/.test(text), "no em or en dashes");
ok(!/\$\s?[0-9]/.test(text), "no dollar figures in previews");
ok(!/\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|synerg\w*|harness\w*)\b/i.test(text), "no AI-tell words");
process.exit(fail ? 1 : 0);
