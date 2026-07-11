import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
await page.goto("http://127.0.0.1:8777/scan.html", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll("input, textarea")].map(i => ({
    n: i.name, fs: getComputedStyle(i).fontSize, w: Math.round(i.getBoundingClientRect().width),
  }));
  const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  const term = document.querySelector(".term-scroll");
  return { overflow, termFs: term ? getComputedStyle(term).fontSize : null, inputs: inputs.slice(0, 4) };
});
console.log(JSON.stringify(info));
await browser.close();
