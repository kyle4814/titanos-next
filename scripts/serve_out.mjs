// Minimal static server for an exported site: /x -> x.html, /x/ -> x/index.html. Usage: node scripts/serve_out.mjs <dir> <port>
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const [, , dir = "out", port = "4100"] = process.argv;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".txt": "text/plain", ".xml": "application/xml", ".woff2": "font/woff2", ".json": "application/json", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".webp": "image/webp", ".pdf": "application/pdf", ".ico": "image/x-icon" };
http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const root = path.resolve(dir);
  const tries = [p, p + ".html", path.join(p, "index.html")].map((x) => path.join(root, x));
  const f = tries.find((x) => x.startsWith(root) && fs.existsSync(x) && fs.statSync(x).isFile());
  if (!f) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(+port, "127.0.0.1");
