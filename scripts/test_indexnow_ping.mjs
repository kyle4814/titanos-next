// Tests for bin/indexnow_ping.mjs: sitemap parsing, key discovery, batching, payload shape, dry run sends nothing.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseSitemap, findKey, batches, payload, main } from "../bin/indexnow_ping.mjs";

let fail = 0;
const ok = (c, m) => { if (!c) { fail += 1; console.error("FAIL", m); } else console.log("ok  ", m); };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "indexnow-"));
const key = "0123456789abcdef0123456789abcdef";
fs.mkdirSync(path.join(dir, "public"));
fs.writeFileSync(path.join(dir, "public", `${key}.txt`), key);
const urls = Array.from({ length: 7 }, (_, i) => `https://titanos.tech/p${i}`);
const xml = `<?xml version="1.0"?><urlset>${urls.map((u) => `<url><loc>${u}</loc></url>`).join("")}<url><loc>https://other.example/x</loc></url><url><loc>https://titanos.tech/p1</loc></url><url><loc>https://titanos.tech/a?x=1&amp;y=2</loc></url></urlset>`;
fs.writeFileSync(path.join(dir, "sitemap.xml"), xml);

const parsed = parseSitemap(xml);
ok(parsed.length === 8, "parses titanos.tech URLs, drops other hosts and duplicates, decodes &amp;");
ok(parsed.includes("https://titanos.tech/a?x=1&y=2"), "decodes entities");
ok(findKey(path.join(dir, "public")) === key, "finds the key file whose content equals its name");
fs.writeFileSync(path.join(dir, "public", "ffffffffffffffffffffffffffffffff.txt"), "wrong");
ok(findKey(path.join(dir, "public")) === key, "ignores a mismatched key file");
ok(batches(parsed, 3).map((b) => b.length).join() === "3,3,2", "batches by size");
ok(batches([1, 2], 99999).length === 1, "batch size is capped at the IndexNow limit");
const pl = payload(key, ["https://titanos.tech/p0"]);
ok(pl.host === "titanos.tech" && pl.keyLocation === `https://titanos.tech/${key}.txt` && pl.urlList.length === 1, "payload shape");

let calls = 0;
const spy = async () => { calls += 1; return { status: 200 }; };
const base = ["--sitemap", path.join(dir, "sitemap.xml"), "--public", path.join(dir, "public")];
ok((await main([...base, "--dry-run"], spy)) === 0 && calls === 0, "dry run exits 0 and sends nothing");
ok((await main([...base, "--batch", "3"], spy)) === 0 && calls === 3, "real run posts one request per batch");
const bad = async () => ({ status: 403 });
ok((await main([...base], bad)) === 1, "a rejected batch gives a non-zero exit");
ok((await main([...base, "--only", "/p1", "--dry-run"], spy)) === 0, "--only filter works");
let threw = false;
try { await main(["--sitemap", path.join(dir, "missing.xml"), "--dry-run"], spy); } catch { threw = true; }
ok(threw, "missing sitemap is an error, not a silent pass");

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
