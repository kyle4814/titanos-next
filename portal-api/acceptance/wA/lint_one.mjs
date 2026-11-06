import fs from "node:fs"; import { spawnSync } from "node:child_process";
const text = (h) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
const ROOT = new URL("../../../", import.meta.url).pathname; fs.mkdirSync("/tmp/wa_accept", {recursive:true}); const f = process.argv[2]; const blocks = fs.readFileSync("../../../out/" + f, "utf8").replace(/<(header|nav|footer)[\s\S]*?<\/\1>/g, " ").replace(/<(script|style)[\s\S]*?<\/\1>/g, " ").split(/<\/(?:li|p|h[1-6]|article|aside|section|tr|figure)>/);
const paras = blocks.map((b) => text(b).trim()).filter(Boolean); fs.writeFileSync("/tmp/wa_accept/x1.txt", paras.join("\n\n"));
const r = spawnSync("python3", ["/home/tech2/klinge-kernel/bin/content_lint.py", "--no-cta", "--figures", "/tmp/wa_accept/x1.txt"], { encoding: "utf8" }); console.log((r.stdout + r.stderr).slice(0, 1500));
console.log(paras.filter((p) => /\d/.test(p)).slice(0, 6).map((p) => "  > " + p.slice(0, 200)).join("\n"));
