// perf_budget core: measure a built static export and compare it with a committed budget. No network, no browser.
import fs from "node:fs";
import path from "node:path";

const IMG = /\.(png|jpe?g|webp|avif|gif|svg|ico)$/i;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

// A script blocks rendering when it is an external <script src> with no async, defer or type=module, and no noModule
// (browsers that run this site skip noModule). Scripts after </head> are not counted: only the head blocks first paint.
export function renderBlocking(html) {
  const head = html.split(/<\/head>/i)[0];
  return [...head.matchAll(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>/gi)].filter(
    (m) => !/\b(async|defer|nomodule)\b/i.test(m[0]) && !/type=["']module["']/i.test(m[0]),
  ).length;
}

export function measure(outDir) {
  const files = walk(outDir);
  const routes = {};
  for (const f of files.filter((f) => f.endsWith(".html"))) {
    const rel = "/" + path.relative(outDir, f).split(path.sep).join("/").replace(/\.html$/, "");
    routes[rel] = { htmlBytes: fs.statSync(f).size, renderBlocking: renderBlocking(fs.readFileSync(f, "utf8")) };
  }
  const sum = (re) => files.filter((f) => re.test(f)).reduce((a, f) => a + fs.statSync(f).size, 0);
  return { routes, jsBytes: sum(/\.m?js$/), imageBytes: sum(IMG) };
}

export function check(m, budget) {
  const fails = [];
  const ov = budget.routeOverrides || {};
  for (const [r, v] of Object.entries(m.routes)) {
    const maxHtml = ov[r]?.maxHtmlBytes ?? budget.maxHtmlBytesPerRoute;
    if (v.htmlBytes > maxHtml) fails.push(`html ${r} ${v.htmlBytes} > ${maxHtml}`);
    if (v.renderBlocking > budget.maxRenderBlockingScriptsPerRoute) fails.push(`render-blocking ${r} ${v.renderBlocking} > ${budget.maxRenderBlockingScriptsPerRoute}`);
  }
  if (m.jsBytes > budget.maxTotalJsBytes) fails.push(`total js ${m.jsBytes} > ${budget.maxTotalJsBytes}`);
  if (m.imageBytes > budget.maxTotalImageBytes) fails.push(`total images ${m.imageBytes} > ${budget.maxTotalImageBytes}`);
  return fails;
}
