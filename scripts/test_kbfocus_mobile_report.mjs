// f428_c10: the committed mobile keyboard-focus report must cover EXACTLY the routes of scripts/export_pages.json.
// Usage: node scripts/test_kbfocus_mobile_report.mjs [report.json] [manifest.json]   (exit 1 on any mismatch)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pageToRoute } from "./lib/allpages.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
export function check(reportFile, manifestFile) {
  const rep = JSON.parse(fs.readFileSync(reportFile, "utf8")), man = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const want = new Set(man.pages.filter((p) => p !== "404.html").map(pageToRoute));
  const got = new Set(rep.pages.map((p) => p.route));
  const errs = [];
  for (const r of want) if (!got.has(r)) errs.push("report missing route " + r);
  for (const r of got) if (!want.has(r)) errs.push("report has route not in manifest " + r);
  if (rep.pages.length !== got.size) errs.push("report has duplicate routes");
  if (rep.pages_total !== man.routes_count) errs.push(`pages_total ${rep.pages_total} != routes_count ${man.routes_count}`);
  if (rep.pages_swept !== man.routes_count) errs.push(`pages_swept ${rep.pages_swept} != routes_count ${man.routes_count}`);
  for (const p of rep.pages) {
    if (!p.swept) errs.push("not swept " + p.route);
    if (!(p.viewports || []).includes("mobile") || p.viewports.length !== 1) errs.push("not a mobile-only sweep " + p.route);
  }
  if (rep.pages_with_defects !== rep.pages.filter((p) => p.defects.length).length) errs.push("pages_with_defects disagrees with pages");
  return errs;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const rf = process.argv[2] || path.join(here, "..", "docs", "kbfocus", "f428_kbfocus_mobile_report.json"), mf = process.argv[3] || path.join(here, "export_pages.json");
  let fail = 0;
  const t = (n, c) => { console.log((c ? "ok   " : "FAIL ") + n); if (!c) fail++; };
  t("committed mobile report matches export manifest", check(rf, mf).length === 0);
  const rep = JSON.parse(fs.readFileSync(rf, "utf8"));
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || "/tmp"), "kbm-"));
  const w = (o) => { const f = path.join(tmp, "r.json"); fs.writeFileSync(f, JSON.stringify(o)); return f; };
  t("mutation: dropped page is caught", check(w({ ...rep, pages: rep.pages.slice(1) }), mf).some((e) => e.startsWith("report missing route")));
  t("mutation: extra page is caught", check(w({ ...rep, pages: [...rep.pages, { route: "/zz-extra", swept: true, viewports: ["mobile"], defects: [] }] }), mf).some((e) => e.includes("not in manifest")));
  t("mutation: unswept page is caught", check(w({ ...rep, pages: rep.pages.map((p, i) => (i ? p : { ...p, swept: false })) }), mf).some((e) => e.startsWith("not swept")));
  t("mutation: desktop viewport is caught", check(w({ ...rep, pages: rep.pages.map((p, i) => (i ? p : { ...p, viewports: ["desktop"] })) }), mf).some((e) => e.includes("mobile-only")));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fail ? "test_kbfocus_mobile_report: RED" : "test_kbfocus_mobile_report: all green");
  process.exit(fail ? 1 : 0);
}
