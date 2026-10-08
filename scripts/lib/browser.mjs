// Launch chromium via playwright; if the pinned revision is not installed, fall back to the newest
// chromium (headless shell or full) found under the playwright cache. Returns null if none works.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export async function launchChromium() {
  const { chromium } = await import("playwright");
  const args = ["--no-sandbox", "--disable-gpu"];
  try {
    return await chromium.launch({ args });
  } catch {
    const root = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), ".cache", "ms-playwright");
    const found = [];
    if (fs.existsSync(root)) {
      for (const d of fs.readdirSync(root).sort().reverse()) {
        if (/^chromium_headless_shell-/.test(d)) found.push(...glob(path.join(root, d), "chrome-headless-shell"));
        else if (/^chromium-/.test(d)) found.push(...glob(path.join(root, d), "chrome"));
      }
    }
    for (const exe of found) {
      try { return await chromium.launch({ args, executablePath: exe }); } catch { /* try next */ }
    }
    return null;
  }
}

function glob(dir, name) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...glob(p, name));
    else if (e.name === name) out.push(p);
  }
  return out;
}
