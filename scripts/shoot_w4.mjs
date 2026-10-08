// Screenshots the W4 regions (#cost-curve, #loop, #proof-wall) at 390/768/1440. Usage: node scripts/shoot_w4.mjs <baseUrl> <outDir>
import { chromium } from "playwright";
const [, , base = "http://127.0.0.1:4177", outDir = "."] = process.argv;
const b = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
const errors = [];
for (const w of [390, 768, 1440]) {
  const page = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
  page.on("console", (m) => m.type() === "error" && errors.push(`${w}: ${m.text().slice(0, 160)}`));
  page.on("pageerror", (e) => errors.push(`${w}: ${String(e).slice(0, 160)}`));
  await page.goto(base + "/", { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => (document.documentElement.style.scrollBehavior = "auto"));
  for (const id of ["cost-curve", "loop", "proof-wall"]) {
    const el = page.locator("#" + id);
    await el.scrollIntoViewIfNeeded();
    await page.evaluate(async (i) => { const e = document.getElementById(i); for (let y = 0; y < e.offsetHeight; y += 400) { e.scrollIntoView(); window.scrollBy(0, y); await new Promise((r) => setTimeout(r, 150)); } }, id);
    if (id === "loop") await page.locator(".w4-node").nth(4).click();
    if (id === "proof-wall") await page.locator(".w4-star button").nth(0).click();
    await page.waitForTimeout(2200);
    await el.screenshot({ path: `${outDir}/w4-${id}-${w}.png` });
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    if (sw > w) errors.push(`${w}: horizontal overflow ${sw} > ${w} at #${id}`);
  }
  await page.close();
}
await b.close();
console.log(errors.length ? "ISSUES:\n" + errors.join("\n") : "no console errors, no horizontal overflow");
