// Browser helpers: a same-process static server for the portal and a headless Windows Chrome launcher (same setup as e2e.mjs).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { PW, CHROME } from './_benv.mjs';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain' };
export function serve(root, { gzip = false } = {}) {
  return new Promise((resolve) => {
    const srv = http.createServer(async (req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
      const buf = fs.readFileSync(f); const type = MIME[path.extname(f)] || 'application/octet-stream';
      const wantsGz = gzip && /\bgzip\b/.test(req.headers['accept-encoding'] || '') && /^(\.html|\.js|\.css|\.json|\.mjs)$/.test(path.extname(f));
      if (wantsGz) { const z = (await import('node:zlib')).gzipSync(buf, { level: 6 }); res.writeHead(200, { 'content-type': type, 'content-encoding': 'gzip', 'content-length': z.length, 'cache-control': 'no-cache' }); return res.end(z); }
      res.writeHead(200, { 'content-type': type, 'content-length': buf.length, 'cache-control': 'no-cache' }); res.end(buf);
    });
    srv.listen(0, '0.0.0.0', () => resolve({ base: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() }));
  });
}
export async function launch() {
  const { chromium } = await import(PW);
  return chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-gpu', '--hide-scrollbars'] });
}
