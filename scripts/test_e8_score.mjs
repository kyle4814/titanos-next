// Essential Eight quick score: scoring maths, question bank integrity and copy rules (no em or en dashes).
// Run: node --experimental-strip-types scripts/test_e8_score.mjs
import fs from "node:fs";
import { score } from "../app/tools/essential-eight-score/score.ts";
import { STRATEGIES, TOTAL_QUESTIONS } from "../app/tools/essential-eight-score/questions.ts";

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log(`FAIL ${m}`); } else console.log(`PASS ${m}`); };
const all = (a) => Object.fromEntries(STRATEGIES.flatMap((s) => s.questions.map((q) => [q.id, a])));

ok(STRATEGIES.length === 8, "eight strategies");
ok(TOTAL_QUESTIONS === 38, "38 questions");
const ids = STRATEGIES.flatMap((s) => s.questions.map((q) => q.id));
ok(new Set(ids).size === ids.length, "question ids unique");
ok(STRATEGIES.every((s) => s.questions.length >= 3), "every strategy has at least 3 questions");

let r = score({});
ok(r.pct === 0 && r.answered === 0 && r.gaps.length === 0, "empty answers score 0 with no gaps");
r = score(all("yes"));
ok(r.pct === 100 && r.gaps.length === 0 && r.band === "all-yes" && r.strategies.every((s) => s.allYes), "all yes = 100%, no gaps, all-yes band");
r = score(all("no"));
ok(r.pct === 0 && r.gaps.length === 38 && r.band === "start", "all no = 0%, 38 gaps");
r = score(all("partial"));
ok(r.pct === 50 && r.gaps.length === 38, "all partly = 50%");

// does-not-apply is removed from both sides
const naIds = STRATEGIES.flatMap((s) => s.questions.filter((q) => q.na).map((q) => q.id));
ok(naIds.length >= 3, "some questions allow does-not-apply");
r = score({ ...all("yes"), ...Object.fromEntries(naIds.map((i) => [i, "na"])) });
ok(r.pct === 100 && r.max === 38 - naIds.length && r.gaps.length === 0, "does-not-apply is excluded from the denominator");
// gap order: No before Partly
const first = STRATEGIES[0].questions;
r = score({ ...all("yes"), [first[0].id]: "partial", [first[1].id]: "no" });
ok(r.gaps.length === 2 && r.gaps[0].answer === "no" && r.gaps[1].answer === "partial", "gap list puts No before Partly");
ok(r.strategies[0].allYes === false && r.strategies[1].allYes === true, "allYes is per strategy");

// copy rules
const src = ["questions.ts", "score.ts", "Tool.tsx", "page.tsx"].map((f) => fs.readFileSync(`app/tools/essential-eight-score/${f}`, "utf8")).join("\n");
ok(!/[–—]/.test(src), "no em or en dashes in the tool source");
const page = fs.readFileSync("app/tools/essential-eight-score/page.tsx", "utf8");
const title = page.match(/const TITLE = "(.*?)"/)[1];
const desc = page.match(/const DESC = "(.*?)"/)[1];
ok(title.length <= 60, `title ${title.length} chars (max 60)`);
ok(desc.length >= 140 && desc.length <= 160, `description ${desc.length} chars (140 to 160)`);
ok(desc.includes(String(TOTAL_QUESTIONS)), "description question count matches the bank");
process.exit(fail ? 1 : 0);
