// Courses gate. Run via `npm test`. Targets: the three written courses are complete and clean.
//  - course.json valid; every lesson/worksheet slug has an .mdx file and no orphan files; quiz well-formed (4 options, answer in range, positions vary)
//  - disclosure of AI use on every course; certificate title set; last lesson ends on the free scan next step
//  - prices only from the existing ladder (lib/offers/offers.json rungs), payment links empty or Stripe https
//  - no em/en dashes, no dollar figures in copy, no AI-tell words or phrases; MDX parser unit cases
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseMdx } from "../lib/courses/mdx.ts";
import offers from "../lib/offers/offers.json" with { type: "json" };
import links from "../lib/courses/links.json" with { type: "json" };

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const ROOT = "content/courses";
const dirs = readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
ok(dirs.length >= 3, `at least 3 courses (${dirs.length})`);

// parser unit cases
const b = parseMdx("## H\n\nHello **bold** there.\n\n- [ ] one\n- [x] two\n\n1. a\n2. b\n\n> q");
ok(b[0].type === "h2" && b[1].text === "Hello bold there." && b[2].items[0].endsWith("one") && b[2].items.length === 2 && b[3].type === "ol" && b[4].type === "quote", "mdx parser: heading, paragraph, checklist, ordered list, quote");

const TELLS = /\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|synerg\w*)\b/i;
const PHR = /in today'?s|let'?s dive|in conclusion|it'?s important to note|game[- ]changer|whether you'?re a|elevate your|look no further/i;
const ladder = new Set(offers.map((o) => o.priceAud).filter((x) => typeof x === "number"));
const priceSrc = readFileSync("lib/courses/prices.ts", "utf8");

for (const d of dirs) {
  const base = join(ROOT, d);
  const c = JSON.parse(readFileSync(join(base, "course.json"), "utf8"));
  ok(c.slug === d, `${d}: slug matches folder`);
  const lessons = c.modules.flatMap((m) => m.lessons);
  ok(c.modules.length >= 3 && lessons.length >= 8, `${d}: ${c.modules.length} modules, ${lessons.length} lessons`);
  ok(c.worksheets.length >= 2 && c.outcomes.length >= 4 && c.audience.length >= 2, `${d}: worksheets, outcomes, audience present`);
  const files = (sub) => existsSync(join(base, sub)) ? readdirSync(join(base, sub)).filter((f) => f.endsWith(".mdx")).map((f) => f.replace(/\.mdx$/, "")).sort() : [];
  ok(JSON.stringify(files("lessons")) === JSON.stringify(lessons.map((l) => l.slug).sort()), `${d}: lesson files match course.json exactly`);
  ok(JSON.stringify(files("worksheets")) === JSON.stringify(c.worksheets.map((w) => w.slug).sort()), `${d}: worksheet files match course.json exactly`);
  const q = c.quiz.questions;
  ok(q.length >= 10 && c.quiz.passPct >= 60 && c.quiz.passPct <= 90, `${d}: quiz has ${q.length} questions, pass ${c.quiz.passPct}%`);
  ok(q.every((x) => x.options.length === 4 && Number.isInteger(x.answer) && x.answer >= 0 && x.answer < 4 && x.why && x.q), `${d}: every question has 4 options, valid answer, explanation`);
  ok(new Set(q.map((x) => x.answer)).size >= 3, `${d}: correct answer position varies`);
  ok(/AI/.test(c.disclosure) && /text only/i.test(c.disclosure), `${d}: AI-use disclosure present`);
  ok(c.certificateTitle && c.offerSlug, `${d}: certificate title and offerSlug set`);
  const m = priceSrc.match(new RegExp(`"${d}":\\s*(\\d+)`));
  ok(m && ladder.has(Number(m[1])), `${d}: price ${m && m[1]} is an existing ladder rung`);
  ok(d in links && (links[d] === "" || links[d].startsWith("https://buy.stripe.com/")), `${d}: payment link empty or Stripe https`);

  let all = JSON.stringify(c);
  let words = 0, thin = [];
  for (const l of lessons) {
    const t = readFileSync(join(base, "lessons", `${l.slug}.mdx`), "utf8");
    const n = t.split(/\s+/).length; words += n; if (n < 250) thin.push(l.slug);
    all += "\n" + t;
    ok(parseMdx(t).length >= 4, `${d}/${l.slug}: parses to 4+ blocks`) ;
  }
  for (const w of c.worksheets) { const t = readFileSync(join(base, "worksheets", `${w.slug}.mdx`), "utf8"); all += "\n" + t; ok(/\[ \]/.test(t), `${d}/${w.slug}: worksheet has checklist lines`); }
  ok(thin.length === 0, `${d}: every lesson 250+ words (${words} total)${thin.length ? " thin: " + thin.join(",") : ""}`);
  const last = readFileSync(join(base, "lessons", `${lessons[lessons.length - 1].slug}.mdx`), "utf8");
  ok(/titanos\.tech\/scan/.test(last), `${d}: last lesson ends on the free scan next step`);
  ok(!/[–—]/.test(all), `${d}: no em or en dashes`);
  ok(!/\$\s?[0-9]|\bAU\$|\b[0-9]+\s?dollars\b/i.test(all), `${d}: no dollar figures in copy`);
  ok(!TELLS.test(all) && !PHR.test(all), `${d}: no AI-tell words or phrases`);
}
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
