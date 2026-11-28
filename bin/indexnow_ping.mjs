#!/usr/bin/env node
// IndexNow ping for titanos.tech (Bing, Yandex and other IndexNow engines).
// Reads the BUILT sitemap (out/sitemap.xml) and POSTs the URLs in batches to https://api.indexnow.org/indexnow.
//
// Run ONLY after the pages are deployed (the key file must be reachable at https://titanos.tech/<key>.txt):
//   node bin/indexnow_ping.mjs            # real ping of every sitemap URL
//   node bin/indexnow_ping.mjs --dry-run  # prints the payloads, sends nothing
// Options: --sitemap <path> (default out/sitemap.xml), --public <dir> (default public), --batch <n> (default 500),
//          --only <prefix> (only URLs whose path starts with the prefix, e.g. /glossary)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const HOST = "titanos.tech";
export const ENDPOINT = "https://api.indexnow.org/indexnow";
export const MAX_BATCH = 10000; // IndexNow limit per request

export function parseSitemap(xml, host = HOST) {
  const urls = [];
  for (const m of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
    const u = m[1].replace(/&amp;/g, "&");
    try {
      if (new URL(u).hostname === host) urls.push(u);
    } catch {
      /* skip malformed */
    }
  }
  return [...new Set(urls)];
}

export function findKey(publicDir) {
  const hits = fs
    .readdirSync(publicDir)
    .filter((f) => /^[a-f0-9]{32}\.txt$/.test(f))
    .filter((f) => fs.readFileSync(path.join(publicDir, f), "utf8").trim() === f.replace(/\.txt$/, ""));
  if (hits.length !== 1) throw new Error(`expected exactly one IndexNow key file in ${publicDir}, found ${hits.length}`);
  return hits[0].replace(/\.txt$/, "");
}

export function batches(list, size) {
  const n = Math.min(Math.max(1, size | 0), MAX_BATCH);
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

export function payload(key, urlList, host = HOST) {
  return { host, key, keyLocation: `https://${host}/${key}.txt`, urlList };
}

function arg(argv, name, dflt) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}

export async function main(argv = process.argv.slice(2), fetchImpl = globalThis.fetch) {
  const dry = argv.includes("--dry-run");
  const sitemap = arg(argv, "--sitemap", "out/sitemap.xml");
  const pub = arg(argv, "--public", "public");
  const size = Number(arg(argv, "--batch", "500"));
  const only = arg(argv, "--only", "");
  if (!fs.existsSync(sitemap)) throw new Error(`built sitemap not found at ${sitemap}: run npm run build first`);
  const key = findKey(pub);
  let urls = parseSitemap(fs.readFileSync(sitemap, "utf8"));
  if (only) urls = urls.filter((u) => new URL(u).pathname.startsWith(only));
  if (!urls.length) throw new Error("no URLs to send");
  const parts = batches(urls, size);
  console.log(`indexnow: ${urls.length} URLs in ${parts.length} batch(es), key ${key.slice(0, 4)}..., ${dry ? "DRY RUN (nothing sent)" : "SENDING"}`);
  let failed = 0;
  for (const [i, part] of parts.entries()) {
    const body = payload(key, part);
    if (dry) {
      console.log(`batch ${i + 1}/${parts.length}: ${part.length} URLs, first ${part[0]}, last ${part[part.length - 1]}`);
      continue;
    }
    const res = await fetchImpl(ENDPOINT, { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });
    // 200 = accepted, 202 = accepted pending key validation
    const ok = res.status === 200 || res.status === 202;
    console.log(`batch ${i + 1}/${parts.length}: HTTP ${res.status} ${ok ? "ok" : "FAILED"}`);
    if (!ok) failed += 1;
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((c) => process.exit(c), (e) => { console.error(`indexnow: ${e.message}`); process.exit(2); });
}
