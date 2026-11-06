import fs from "node:fs"; import path from "node:path"; import { spawnSync } from "node:child_process";
const ROOT = new URL("../../../", import.meta.url).pathname; const out = ROOT + "out"; fs.mkdirSync("/tmp/wa_accept", {recursive:true}); const dir = fs.mkdtempSync("/tmp/wa_accept/lint-");
const text = (h) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ");
const pages = []; (function w(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!["_next", "data"].includes(e.name)) w(p); } else if (e.name.endsWith(".html") && !e.name.startsWith("404")) pages.push(p); } })(out);
const want = process.argv[2] ? new RegExp(process.argv[2]) : /./;
let bad = 0, n = 0; const rows = [];
for (const p of pages) { const route = "/" + path.relative(out, p).replace(/index\.html$/, "").replace(/\.html$/, ""); if (!want.test(route)) continue; n++;
  const blocks = fs.readFileSync(p, "utf8").replace(/<(header|nav|footer)[\s\S]*?<\/\1>/g, " ").replace(/<(script|style)[\s\S]*?<\/\1>/g, " ").split(/<\/(?:li|p|h[1-6]|article|aside|section|tr|figure)>/);
  const f = path.join(dir, "x.txt"); fs.writeFileSync(f, blocks.map((b) => text(b).trim()).filter(Boolean).join("\n\n"));
  const r = spawnSync("python3", ["/home/tech2/klinge-kernel/bin/content_lint.py", "--no-cta", "--figures", f], { encoding: "utf8" });
  if (r.status !== 0) { bad++; rows.push(route + " :: " + (r.stdout + r.stderr).trim().split("\n").slice(0, 3).join(" / ").slice(0, 220)); } }
console.log(`pages linted ${n}, failing ${bad}`); console.log(rows.slice(0, 40).join("\n"));
