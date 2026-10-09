// The overflow gate must bite: a deliberately broken page fails it, a clean page passes. Fixture sites live in a temp dir.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "qaob-"));
if (!root.startsWith(os.tmpdir())) { console.error("bad fixture root"); process.exit(97); }
const site = (name, body) => { const d = path.join(root, name); fs.mkdirSync(d); fs.writeFileSync(path.join(d, "index.html"), `<!doctype html><html><body style="margin:0">${body}</body></html>`); return d; };
const run = (dir) => spawnSync("node", [path.join(import.meta.dirname, "qa_overflow.mjs"), dir, path.join(root, "rep-" + path.basename(dir))], { encoding: "utf8", env: { ...process.env, CONC: "1" } });

const clean = site("clean", `<main><p>Hello</p><a href="/x" style="display:inline-flex;align-items:center;min-height:44px;min-width:44px">Go</a></main>`);
const bad = {
  hscroll: `<div style="width:900px">wide</div>`,
  textbox: `<div style="width:60px;border:1px solid red;white-space:nowrap;overflow:visible">averyveryverylongunbreakablelabel</div>`,
  outside: `<div style="width:80px;height:30px;border:1px solid red"><span style="display:inline-block;position:relative;left:120px">out</span></div>`,
  tap: `<main><a href="/x" style="display:block;height:20px;width:60px">tiny</a></main>`,
  console: `<script>console.error("boom")</script>`,
};
let fail = 0;
const expect = (name, dir, wantFail) => {
  const r = run(dir); const failed = r.status === 1;
  if (failed === wantFail) console.log(`PASS ${name}`); else { fail++; console.log(`FAIL ${name} (exit ${r.status})\n${(r.stdout + r.stderr).slice(-400)}`); }
};
expect("clean page passes", clean, false);
for (const [k, v] of Object.entries(bad)) expect(`broken page fails: ${k}`, site(k, v), true);
fs.rmSync(root, { recursive: true, force: true });
console.log(fail ? `${fail} failed` : "all passed");
process.exit(fail ? 1 : 0);
