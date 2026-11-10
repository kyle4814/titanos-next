// Tests for a11y_static.mjs: every rule has a failing and a passing fixture; a mutant (rule disabled) must be caught.
import { scanHtml, RULES, compareBaseline, ratio, parseColour } from "./a11y_static.mjs";
const wrap = (body, lang = ' lang="en-AU"') => `<!DOCTYPE html><html${lang}><head><title>t</title></head><body>${body}</body></html>`;
const H = "<h1>Title</h1>";
const FIX = {
  "html-lang": { bad: wrap(H, ""), good: wrap(H) },
  "h1-one": { bad: wrap("<h1>a</h1><h1>b</h1>"), good: wrap(H) },
  "heading-skip": { bad: wrap(H + "<h3>x</h3>"), good: wrap(H + "<h2>x</h2><h3>y</h3>") },
  "img-alt": { bad: wrap(H + '<img src="/a.png">'), good: wrap(H + '<img src="/a.png" alt="A"><img src="/b.png" alt="">') },
  "form-label": { bad: wrap(H + '<input type="text" id="q">'), good: wrap(H + '<label for="q">Q</label><input type="text" id="q"><label>N<input type="text"></label><input type="text" aria-label="z"><input type="hidden" name="h">') },
  "link-button-name": { bad: wrap(H + '<button></button><a href="/x"><svg></svg></a>'), good: wrap(H + '<button>Go</button><a href="/x"><img src="/i.png" alt="Home"></a><a href="/y" aria-label="Y"></a>') },
  "dup-id": { bad: wrap(H + '<div id="a"></div><p id="a"></p>'), good: wrap(H + '<div id="a"></div><p id="b"></p>') },
  "tabindex-positive": { bad: wrap(H + '<div tabindex="3">x</div>'), good: wrap(H + '<div tabindex="0">x</div><div tabindex="-1">y</div>') },
  "contrast-inline": { bad: wrap(H + '<p style="color:#777;background:#888">low</p>'), good: wrap(H + '<p style="color:#000;background:#fff">ok</p><p style="color:var(--x);background:#fff">skipped, not literal</p>') },
};
let fail = 0;
const t = (name, ok) => { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"} ${name}`); };
const hits = (html, rule, opt) => scanHtml(html, opt).filter((v) => v.rule === rule).length;

for (const r of RULES) {
  t(`${r}: failing fixture flagged`, hits(FIX[r].bad, r) >= 1);
  t(`${r}: passing fixture clean (all rules)`, scanHtml(FIX[r].good).length === 0);
}
// mutant: disabling a rule must make its failing fixture go silent, which the harness above would then catch
for (const r of RULES) {
  const caught = hits(FIX[r].bad, r, { disable: [r] }) === 0 && hits(FIX[r].bad, r) >= 1;
  t(`mutant (${r} disabled) caught: failing fixture no longer flagged`, caught);
}
// parser edge cases
t("script/style bodies ignored", scanHtml(wrap(H + '<script>"<img src=x>"</script><style>a{}</style>')).length === 0);
t("aria-hidden img/heading skipped", scanHtml(wrap(H + '<div aria-hidden="true"><img src="x"><h4>z</h4></div>')).length === 0);
t("contrast maths: black/white 21", Math.abs(ratio(parseColour("#000"), parseColour("#fff")) - 21) < 0.01);
t("large text relaxes to 3:1", scanHtml(wrap(H + '<p style="color:#777;background:#fff;font-size:30px">x</p>')).length === 0);
t("baseline compare flags increase only", compareBaseline({ "img-alt": 2 }, { byRule: { "img-alt": 1 } }).length === 1 && compareBaseline({ "img-alt": 1 }, { byRule: { "img-alt": 1 } }).length === 0);
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
