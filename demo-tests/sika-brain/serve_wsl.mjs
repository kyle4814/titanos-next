// serve_wsl.mjs: static server for the portal with gzip (what GitHub Pages does), run in WSL so the disk is fast. usage: node serve_wsl.mjs <portalDir> <port>
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const [, , root, port = '8751'] = process.argv;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  const buf = fs.readFileSync(f), ext = path.extname(f), type = MIME[ext] || 'application/octet-stream';
  if (/\bgzip\b/.test(req.headers['accept-encoding'] || '') && /^(\.html|\.js|\.css|\.json|\.mjs|\.xml)$/.test(ext)) { const z = zlib.gzipSync(buf, { level: 6 }); res.writeHead(200, { 'content-type': type, 'content-encoding': 'gzip', 'content-length': z.length, 'cache-control': 'no-cache' }); return res.end(z); }
  res.writeHead(200, { 'content-type': type, 'content-length': buf.length, 'cache-control': 'no-cache' }); res.end(buf);
}).listen(Number(port), '0.0.0.0', () => console.log('serving', root, port));
