import fs from "node:fs"; import path from "node:path";
const root = new URL("../../../", import.meta.url).pathname.replace(/\/$/, "");
let known = ""; (function w(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!["node_modules", ".next", "out", ".git"].includes(e.name)) w(p); } else if (/\.(json|ts|tsx|tsv|md)$/.test(e.name) && !p.includes("/scripts/") && !p.includes("test")) known += fs.readFileSync(p, "utf8").replace(/[,\s]/g, ""); } })(root + "/lib");
// stricter: restrict "known" to data files that C9 cites
const cited = ["lib/ledger.json", "lib/site-data/proof.json", "lib/site-data/trust.json", "lib/site-data/provenance.json", "lib/site-data/sectors.json"].filter((f) => fs.existsSync(root + "/" + f)).map((f) => fs.readFileSync(root + "/" + f, "utf8")).join("").replace(/[,\s]/g, "");
const text = (h) => h.replace(/<(script|style)[\s\S]*?<\/\1>/g, " ").replace(/<(header|nav|footer)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
for (const r of process.argv.slice(2)) { const body = text(fs.readFileSync(`${root}/out/${r}.html`, "utf8")); const nums = [...new Set([...body.matchAll(/\b\d[\d.,]*\d\b|\b\d\b/g)].map((m) => m[0].replace(/,/g, "")))];
  const notCited = nums.filter((n) => !cited.includes(n)); console.log(r.padEnd(14), "numbers", nums.length, "not in C9-cited data files:", notCited.length, notCited.slice(0, 12).join(",")); }
