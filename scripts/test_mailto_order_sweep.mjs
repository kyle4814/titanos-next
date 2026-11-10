// Tests for scripts/mailto_order_sweep.mjs. Fixtures only (synthetic, in a checked temp dir).
// Run via `npm test`. The live tree is measured with --report (always exit 0); the gate
// mode (exit 1 on an order-page leak) is proven on fixtures, not on the live tree, because
// this stage deliberately edits no page.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SWEEP = path.join(HERE, "mailto_order_sweep.mjs");
const REAL_ALLOW = path.join(HERE, "mailto_allowlist.json");
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };

const base = fs.mkdtempSync(path.join(os.tmpdir(), "mailto_sweep_"));
if (!base || !base.startsWith(os.tmpdir() + path.sep)) { console.log("FAIL unsafe temp dir"); process.exit(1); }
const w = (root, p, s) => { const f = path.join(root, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const run = (root, extra = []) => {
  const r = spawnSync("node", [SWEEP, "--root", root, "--json", ...extra], { encoding: "utf8" });
  let j = null; try { j = JSON.parse(r.stdout); } catch { /* leave null */ }
  return { code: r.status, j, out: r.stdout, err: r.stderr };
};

try {
  // ---- fixture A: leaks on an order page, via a shared component, plus an allowed contact page
  const A = path.join(base, "A");
  w(A, "app/offers/[slug]/page.tsx", `import Cta from "@/components/Cta";\nexport default function P(){ return <Cta/>; }\n`);
  w(A, "components/Cta.tsx", `export default function Cta(){\n  const i = \`mailto:sales@example.test?subject=\${encodeURIComponent("Interest")}\`;\n  return <a href={i}>Buy now</a>;\n}\n`);
  w(A, "app/contact/page.tsx", `export default function C(){ return <a href="mailto:hello@example.test">hello</a>; }\n`);
  w(A, "app/order/ai/page.tsx", `export default function O(){ return <a href="/order/ai?tier=ops">Order now</a>; }\n`);
  w(A, "app/blog/page.tsx", `export default function B(){ return <a href="/blog/how-to-order-things-well-and-quickly-always">Read how to order things well and quickly always</a>; }\n`);
  w(A, "public/.well-known/security.txt", "Contact: mailto:security@example.test\n");
  w(A, "app/layout.tsx", `// the mailto: directive below is a CSP comment only\nexport const csp = "form-action 'self' mailto:";\n`);
  const a = run(A);
  ok(a.j !== null, "A: JSON parses");
  ok(a.code === 1, `A: exit 1 on a leak on an order page (got ${a.code})`);
  const rowsA = a.j?.rows ?? [];
  const leak = rowsA.find((r) => r.file === "components/Cta.tsx");
  ok(leak && leak.status === "LEAK-ORDER", "A: component mailto is attributed to /offers/[slug] through the import graph and fails");
  ok(leak && leak.routes.includes("/offers/[slug]") && leak.line === 2, "A: table row carries page route and source line");
  ok(leak && leak.checkoutExists === "yes", "A: row says a checkout route exists for the offers page");
  ok(rowsA.find((r) => r.file === "app/contact/page.tsx")?.status === "ALLOWED", "A: bare contact mailto is ALLOWED");
  ok(rowsA.find((r) => r.file === "public/.well-known/security.txt")?.status === "ALLOWED", "A: security.txt mailto is ALLOWED");
  ok(rowsA.every((r) => r.file !== "app/layout.tsx"), "A: comment and CSP text are not counted as links");
  ok(rowsA.every((r) => r.file !== "app/order/ai/page.tsx"), "A: a CTA routed to /order/... is not a leak");
  ok(rowsA.every((r) => r.file !== "app/blog/page.tsx"), "A: a long article-card link containing 'order' is not a CTA");
  ok(a.j?.summary?.builtTree === "ABSENT", "A: no out/ tree is reported as ABSENT, not as zero leaks");
  const rep = run(A, ["--report"]);
  ok(rep.code === 0, "A: --report exits 0 on the same leak (measurement mode)");

  // ---- fixture B: a non-checkout order CTA (internal route that is not checkout)
  const B = path.join(base, "B");
  w(B, "app/products/[slug]/page.tsx", `export default function P(){ return <a href="/pricing-sheet">Get started</a>; }\n`);
  const b = run(B);
  ok(b.code === 1 && b.j.rows.some((r) => r.kind === "CTA" && r.status === "LEAK-ORDER"), "B: a Get started CTA to a non-checkout route fails");

  // ---- fixture C: clean tree passes; built out/ tree is scanned and fails on a rendered mailto
  const C = path.join(base, "C");
  w(C, "app/order/ai/page.tsx", `export default function O(){ return <a href="/order/ai">Order now</a>; }\n`);
  w(C, "app/contact/page.tsx", `export default function X(){ return <a href="mailto:hello@example.test">hi</a>; }\n`);
  const c = run(C);
  ok(c.code === 0 && c.j.summary.failing === 0, "C: clean source passes (exit 0)");
  w(C, "out/offers/thing.html", `<html><body>\n<a href="mailto:sales@example.test?subject=Interest%3A%20Thing&amp;body=x">Buy now</a>\n<a href="mailto:hello@example.test">Contact</a>\n</body></html>\n`);
  w(C, "out/_next/static/x.html", `<a href="mailto:ignored@example.test?subject=x">Buy now</a>`);
  const c2 = run(C);
  ok(c2.j.summary.builtTree === "SCANNED", "C: built tree is detected and scanned");
  ok(c2.code === 1, "C: a rendered order mailto in out/ fails the sweep");
  const br = c2.j.rows.filter((r) => r.scope === "built");
  ok(br.length === 2, `C: built scan finds 2 mailto links and skips _next (got ${br.length})`);
  ok(br.find((r) => r.link.includes("subject"))?.line === 2, "C: built row carries the html line number");
  ok(br.find((r) => !r.link.includes("subject"))?.status === "ALLOWED", "C: rendered bare contact link is ALLOWED");
  ok(c2.j.summary.remainingBuilt === 1, "C: remaining built count is 1");

  // ---- allow-list discipline
  const noReason = path.join(base, "allow_noreason.json");
  const al = JSON.parse(fs.readFileSync(REAL_ALLOW, "utf8"));
  al.allow = [{ id: "x", target: "^mailto:" }];
  fs.writeFileSync(noReason, JSON.stringify(al));
  const nr = spawnSync("node", [SWEEP, "--root", C, "--allow", noReason], { encoding: "utf8" });
  ok(nr.status === 2, "allow-list: an entry with no reason is refused (exit 2)");
  const real = JSON.parse(fs.readFileSync(REAL_ALLOW, "utf8"));
  ok(real.allow.length > 0 && real.allow.every((e) => e.id && e.reason && e.reason.length > 15), "allow-list: every real entry has an id and a reason");

  // ---- the live tree, measured (report mode); source always, built if out/ exists
  const live = spawnSync("node", [SWEEP, "--report", "--json"], { encoding: "utf8" });
  let lj = null; try { lj = JSON.parse(live.stdout); } catch { /* */ }
  ok(live.status === 0 && lj !== null, "live: report mode runs on the real tree and emits JSON");
  ok(lj && lj.summary.source.total >= 1, `live: source scan found links (found ${lj?.summary.source.total}, remaining ${lj?.summary.remaining})`);
  console.log(`INFO live source remaining=${lj?.summary.remaining} builtTree=${lj?.summary.builtTree} builtRemaining=${lj?.summary.remainingBuilt}`);
} finally {
  if (base && base.startsWith(os.tmpdir() + path.sep) && base.includes("mailto_sweep_")) fs.rmSync(base, { recursive: true, force: true });
}
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
