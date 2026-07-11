// Viewport screenshot helper for design review.
// Usage: node scripts/screenshot.mjs <url> <out.png> <width> <height> [fullPage|scrollY]
//   fullPage: pass "full" — auto-scrolls first so IntersectionObserver
//   reveals fire, then captures the whole page.
//   scrollY: a number — scrolls there, settles, captures the viewport.
// Requires: npm i -D playwright && npx playwright install chromium --only-shell
import { chromium } from "playwright";

const [, , url, out, w, h, mode] = process.argv;
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage({
  viewport: { width: +w, height: +h },
  deviceScaleFactor: 2,
});
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1800);
// Instant jumps — the site's scroll-behavior:smooth crawls in headless
// and screenshots land mid-flight otherwise.
await page.evaluate(() => {
  document.documentElement.style.scrollBehavior = "auto";
});

if (mode === "full") {
  // Walk the page so whileInView / IO reveals trigger, then return to top.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.7;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: out, fullPage: true });
} else {
  if (mode && !Number.isNaN(+mode)) {
    await page.evaluate((y) => window.scrollTo(0, y), +mode);
    await page.waitForTimeout(900);
  }
  await page.screenshot({ path: out, fullPage: false });
}
await browser.close();
console.log("OK", out);
