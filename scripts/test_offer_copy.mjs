// Visible offer copy must carry no AI-tell words (content_lint list) or em/en dashes. Slugs are exempt.
import fs from "node:fs";
const raw = JSON.parse(fs.readFileSync(new URL("../lib/offers/offers.json", import.meta.url), "utf8"));
const TELLS = /\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|synerg\w*|harness\w*)\b|[–—]/i;
const hits = [];
const walk = (v, k = "") => {
  if (typeof v === "string") { if (k !== "slug" && TELLS.test(v)) hits.push(`${k}: ${v.slice(0, 70)}`); }
  else if (Array.isArray(v)) v.forEach((x) => walk(x, k));
  else if (v && typeof v === "object") for (const [kk, x] of Object.entries(v)) walk(x, kk);
};
walk(raw);
hits.forEach((h) => console.log("FAIL " + h));
console.log(hits.length ? `FAIL ${hits.length}` : "ALL PASS");
process.exit(hits.length ? 1 : 0);
