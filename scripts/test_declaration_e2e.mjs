// Browser test of the declaration popup against the built export. Usage: node scripts/test_declaration_e2e.mjs [outDir=out]
// Needs out/ (npm run build) and playwright's chromium. Missing either is a SKIP locally, a FAIL when DECL_E2E_REQUIRE=1 (the cloud gate sets it).
import fs from "node:fs";
import { spawn } from "node:child_process";
const out = process.argv[2] || "out";
const REQUIRE = process.env.DECL_E2E_REQUIRE === "1";
const bail = (why) => { console.log(`${REQUIRE ? "FAIL" : "SKIP"} declaration e2e: ${why}`); process.exit(REQUIRE ? 1 : 0); };
if (!fs.existsSync(out + "/index.html")) bail(`no built export at ${out}`);
let chromium;
try { ({ chromium } = await import("playwright")); } catch { bail("playwright not installed"); }
const PORT = 4173 + Math.floor(Math.random() * 400);
const srv = spawn("node", ["scripts/serve_out.mjs", out, String(PORT)], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 700));
let browser;
try { browser = await chromium.launch(); } catch (e) { srv.kill(); bail("chromium not available: " + String(e).split("\n")[0]); }
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const base = `http://127.0.0.1:${PORT}`;
const KEY = "titanos.declaration.dismissed.2026-11";
const DLG = "[data-declaration-popup] [role=dialog]";
try {
  // 1 first visit: popup renders as a modal dialog with the content
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(base + "/", { waitUntil: "load" });
  await page.waitForSelector(DLG, { timeout: 15000 }).catch(() => {});
  ok(await page.locator(DLG).count() === 1, "popup renders on first visit");
  ok((await page.locator(DLG).getAttribute("aria-modal")) === "true", "popup is aria-modal");
  const t = await page.locator(DLG).innerText();
  ok(/final business declaration/i.test(t) && /Case studies/.test(t) && /Trading platform \(includes the AI course\)/.test(t) && /Sales course/.test(t), "popup shows headline, case studies and both course cards");
  ok(await page.locator('[data-declaration-popup] a[href="https://learn-trading.titanos.tech"]').count() === 1 && await page.locator('[data-declaration-popup] a[href="https://learn-sales.titanos.tech"]').count() === 1, "course cards link to the sign-up URLs");
  ok(await page.evaluate(() => document.activeElement?.hasAttribute("data-close")), "focus starts on the X button");
  // 2 focus trap: Tab many times, focus never leaves the dialog
  let inside = true;
  for (let i = 0; i < 40; i++) { await page.keyboard.press("Tab"); inside = inside && (await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))); }
  ok(inside, "Tab stays inside the dialog (focus trap)");
  // 3 X dismisses and is remembered across a reload
  await page.locator("[data-close]").click();
  ok(await page.locator(DLG).count() === 0, "X closes the popup");
  ok((await page.evaluate((k) => localStorage.getItem(k), KEY)) === "1", "dismissal is written to localStorage");
  await page.reload({ waitUntil: "load" }); await page.waitForTimeout(1500);
  ok(await page.locator(DLG).count() === 0, "popup does not return after a reload (remembered)");
  // 4 Esc closes
  const p2 = await (await browser.newContext()).newPage();
  await p2.goto(base + "/", { waitUntil: "load" }); await p2.waitForSelector(DLG, { timeout: 15000 });
  await p2.keyboard.press("Escape");
  ok(await p2.locator(DLG).count() === 0, "Esc closes the popup");
  // 5 not shown on /declaration, which is a normal page with the content
  const p3 = await (await browser.newContext()).newPage();
  await p3.goto(base + "/declaration", { waitUntil: "load" }); await p3.waitForTimeout(1500);
  ok(await p3.locator(DLG).count() === 0, "popup is not shown on /declaration");
  ok(await p3.locator("h1").innerText().then((x) => /final business declaration/i.test(x)), "/declaration renders its headline");
  // 6 storage that throws must not break anything: popup still shows once, closes, no page error
  const ctx4 = await browser.newContext();
  await ctx4.addInitScript(() => { const boom = () => { throw new DOMException("blocked", "SecurityError"); }; Object.defineProperty(window, "localStorage", { get: boom }); });
  const p4 = await ctx4.newPage(); const errs = []; p4.on("pageerror", (e) => errs.push(String(e)));
  await p4.goto(base + "/", { waitUntil: "load" }); await p4.waitForSelector(DLG, { timeout: 15000 });
  await p4.locator("[data-close]").click();
  ok(await p4.locator(DLG).count() === 0 && !errs.some((e) => /localStorage|SecurityError|blocked/.test(e)), "blocked localStorage: popup still opens and closes with no page error");
  // 7 mailing-list signup posts consent (the course-tag waitlist branch is covered in test_declaration.mjs via courseAction) (network intercepted, nothing leaves the machine)
  const ctx5 = await browser.newContext(); const p5 = await ctx5.newPage();
  let posted = null;
  await ctx5.route("**/v1/subscribe", async (route) => { posted = JSON.parse(route.request().postData() || "{}"); await route.fulfill({ status: 201, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: '{"ok":true}' }); });
  await p5.goto(base + "/declaration", { waitUntil: "load" });
  const card = p5.locator('#daily-artifacts ~ form').first();
  await card.locator('input[name="email"]').fill("reader@example.test"); await card.locator("button[type=submit]").click();
  await p5.waitForTimeout(800);
  ok(posted && posted.consent === true && posted.email === "reader@example.test" && posted.tags.includes("daily-artifacts") && posted.source === "declaration-page", "mailing-list signup posts consent and the daily-artifacts tag");
} finally { await browser.close(); srv.kill(); }
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
