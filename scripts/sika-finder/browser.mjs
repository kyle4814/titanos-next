// Shared helper for the browser checks: launches Chrome (playwright-core from the repo's node_modules), locked to the local server.
import fs from 'node:fs';
// Run with Windows node (node.exe) from WSL: snap chromium does not start here and Windows Chrome cannot be piped from Linux node.
const WIN = process.platform === 'win32';
const PW = process.env.PW_CORE || (WIN ? 'file://wsl.localhost/Ubuntu/home/tech2/titanos_launch/titanos-next/node_modules/playwright-core/index.mjs' : '/home/tech2/titanos_launch/titanos-next/node_modules/playwright-core/index.mjs');
export async function launch() {
  const { chromium } = await import(PW);
  const exe = process.env.CHROME || (WIN ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : ['/snap/bin/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p)));
  return chromium.launch({ executablePath: exe, headless: true, args: ['--disable-gpu', '--no-sandbox', '--hide-scrollbars'] });
}
export const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
export function newTally(name) {
  let pass = 0, fail = 0;
  return {
    ok(n, c, d = '') { if (c) { pass++; console.log('PASS ' + n); } else { fail++; console.log('FAIL ' + n + (d ? ' :: ' + String(d).slice(0, 240) : '')); } },
    done() { console.log(`\n${name}: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); },
  };
}
export async function ready(page) { await page.waitForSelector('main:not([aria-busy]):not(:has(.skeleton))', { timeout: 20000 }); await page.waitForTimeout(200); }
