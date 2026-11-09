// Mutation check for test_concierge_lazy.mjs: put the static import back and require the test to FAIL. Scratch copy only.
// Optional arg: a pre-fix built out/ dir (the build made with the static import); the built-output half must FAIL against it too.
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
const real = new URL("..", import.meta.url).pathname;
const BEFORE_OUT = process.argv[2];
const MUTANTS = [
  ["static catalogue import back in Concierge", "components/Concierge.tsx", 'import { loadAsk } from "@/lib/concierge/lazy";', 'import { makeAsk } from "@/lib/concierge/catalogue";\nimport { loadAsk } from "@/lib/concierge/lazy";'],
  ["static offer data import in lazy.ts", "lib/concierge/lazy.ts", 'import { buildIndex', 'import { OFFERS_TRADIES } from "../offers/data/tradies.ts";\nvoid OFFERS_TRADIES;\nimport { buildIndex'],
  ["dynamic import of the catalogue in a page", "app/faq/page.tsx", "export default function FaqPage() {", 'void import("@/lib/concierge/catalogue");\nexport default function FaqPage() {'],
  ["loadAsk called at render top level", "components/Concierge.tsx", "const askRef = useRef<Promise<Ask> | null>(null);", "const askRef = useRef<Promise<Ask> | null>(null);\n  const eager = loadAsk(); void eager;"],
  ["shelves.json stale", "public/concierge/shelves.json", "[{", "[ {"],
];
const copy = () => {
  const d = fs.mkdtempSync(os.tmpdir() + "/f307_mut_");
  if (!d.startsWith(os.tmpdir() + "/f307_mut_")) throw new Error("unsafe scratch dir");
  for (const p of ["lib", "components", "app", "public/concierge", "scripts"]) { fs.mkdirSync(d + "/" + p, { recursive: true }); fs.cpSync(real + p, d + "/" + p, { recursive: true }); }
  return d;
};
const run = (d) => { try { execFileSync("node", ["--experimental-strip-types", d + "/scripts/test_concierge_lazy.mjs"], { env: { ...process.env, LAZY_ROOT: d }, stdio: "pipe" }); return 0; } catch (e) { return e.status || 1; } };
let bad = 0;
const base = copy(); const baseCode = run(base); fs.rmSync(base, { recursive: true, force: true });
console.log("unmutated copy:", baseCode === 0 ? "PASS (required)" : "FAIL (BAD)"); if (baseCode) bad++;
for (const [name, file, from, to] of MUTANTS) {
  const d = copy(); const f = d + "/" + file; const src = fs.readFileSync(f, "utf8");
  if (!src.includes(from)) { console.log("MUTANT NOT APPLIED:", name); bad++; fs.rmSync(d, { recursive: true, force: true }); continue; }
  fs.writeFileSync(f, src.replace(from, to));
  const code = run(d); fs.rmSync(d, { recursive: true, force: true });
  console.log((code ? "KILLED  " : "SURVIVED ") + name); if (!code) bad++;
}
if (BEFORE_OUT) {
  const d = copy(); fs.cpSync(BEFORE_OUT, d + "/out", { recursive: true });
  const code = run(d); fs.rmSync(d, { recursive: true, force: true });
  console.log((code ? "KILLED  " : "SURVIVED ") + "built-output half against the pre-fix build"); if (!code) bad++;
}
console.log(bad ? "MUTATION CHECK FAILED: " + bad : "MUTATION CHECK OK: all mutants killed, unmutated copy green");
process.exit(bad ? 1 : 0);
