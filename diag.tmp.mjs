import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
const errors = [];
page.on("pageerror", e => errors.push(String(e).slice(0, 150)));
await page.goto("http://127.0.0.1:8777/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2000);
const out = await page.evaluate(async () => {
  document.documentElement.style.scrollBehavior = "auto";
  window.scrollTo(0, 2400);
  await new Promise(r => setTimeout(r, 2500));
  const reveals = [...document.querySelectorAll("[data-reveal]")].slice(0, 8).map((s) => {
    const r = s.getBoundingClientRect();
    return { top: Math.round(r.top), state: s.getAttribute("data-reveal"), opacity: getComputedStyle(s).opacity };
  });
  const hydrated = !!document.querySelector("[data-reveal='in']");
  return { scrollY: window.scrollY, hydrated, reveals };
});
console.log(JSON.stringify(out));
console.log("ERR:", JSON.stringify(errors.slice(0,4)));
await browser.close();
