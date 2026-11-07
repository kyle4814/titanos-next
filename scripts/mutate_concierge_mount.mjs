// Mutation check for the F-C6 tests: copy the sources to a scratch dir, put each bug back, and require test_concierge_mount.mjs to FAIL.
// The unmutated copy must pass first. Nothing under the real tree is touched.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const real = new URL("..", import.meta.url).pathname;
const MUTANTS = [
  ["junk guard off (a)", "lib/concierge/router.ts", 'if (junkCheck(raw).junk) return unmatched(raw, seat, "junk");', ""],
  ["reject list emptied (a)", "lib/concierge/guard.ts", "for (const r of REJECT) if (r.rx.test(s))", "for (const r of [] as typeof REJECT) if (r.rx.test(s))"],
  ["confidence floor off (a)", "lib/concierge/router.ts", "top.s < CONF_FLOOR || ", ""],
  ["html-tag rule removed (a)", "lib/concierge/guard.ts", '{ name: "html-tag", rx: /<\\s*\\/?\\s*[a-z!][^>]{0,200}>/i },', ""],
  ["injection rule removed (a)", "lib/concierge/guard.ts", "rx: /\\b(?:ignore|disregard|forget|override|bypass)", "rx: /\\b(?:zzignore|zzdisregard)"],
  ["claims logged always (b)", "lib/concierge/router.ts", "return ok ? { ...r, saved: true, message: MSG_SAVED } : r;", "return { ...r, saved: true, message: MSG_SAVED };"],
  ["MemoryLog counted as durable (b)", "lib/concierge/router.ts", "ok = log.durable !== false && res !== false;", "ok = res !== false;"],
  ["false return counted as saved (b)", "lib/concierge/router.ts", "ok = log.durable !== false && res !== false;", "ok = log.durable !== false;"],
  ["throw swallowed as saved (b)", "lib/concierge/router.ts", "} catch { ok = false; }", "} catch { ok = true; }"],
  ["junk gets logged (b)", "lib/concierge/router.ts", 'if (r.kind !== "unmatched" || r.reason === "junk") return r;', 'if (r.kind !== "unmatched") return r;'],
  ["old 'I have logged it' text back (b)", "lib/concierge/router.ts", 'export const MSG_NOT_SAVED = "I do not have that on a shelf yet. This ask was not saved, so please use the contact page to reach a person.";', 'export const MSG_NOT_SAVED = "I do not have that on a shelf yet. I have logged it, and you will get a quote after review.";'],
  ["component unmounted (c)", "app/faq/page.tsx", "<Concierge />", ""],
  ["component fetches (c)", "components/Concierge.tsx", "const askRef = useRef<Awaited<ReturnType<typeof loadAsk>> | null>(null);", "const askRef = useRef<Awaited<ReturnType<typeof loadAsk>> | null>(null); void fetch('/x');"],
  ["not-open shelf linked (c)", "lib/concierge/view.ts", 'const OPEN = new Set(["LIVE", "READY"]);', 'const OPEN = new Set(["LIVE", "READY", "PLANNED", "NOT_YET_OPEN"]);'],
  ["floor so high it drops correct asks (non-regression)", "lib/concierge/router.ts", "export const CONF_FLOOR = 7.0;", "export const CONF_FLOOR = 11.0;"],
];
const copy = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "f26_mut_"));
  if (!d.startsWith(os.tmpdir() + "/f26_mut_")) throw new Error("unsafe scratch dir");
  for (const p of ["lib/concierge", "lib/offers", "components/Concierge.tsx", "app/faq/page.tsx", "scripts"]) { fs.mkdirSync(path.dirname(d + "/" + p), { recursive: true }); fs.cpSync(real + p, d + "/" + p, { recursive: true }); }
  return d;
};
const runTest = (d) => { try { execFileSync("node", ["--experimental-strip-types", d + "/scripts/test_concierge_mount.mjs"], { env: { ...process.env, CONCIERGE_ROOT: d }, stdio: "pipe" }); return 0; } catch (e) { return e.status || 1; } };
let bad = 0;
const base = copy(); const baseCode = runTest(base); fs.rmSync(base, { recursive: true, force: true });
console.log("unmutated copy:", baseCode === 0 ? "PASS (required)" : "FAIL (BAD)"); if (baseCode !== 0) bad++;
for (const [name, file, from, to] of MUTANTS) {
  const d = copy(); const f = d + "/" + file; const src = fs.readFileSync(f, "utf8");
  if (!src.includes(from)) { console.log("MUTANT NOT APPLIED (pattern missing):", name); bad++; fs.rmSync(d, { recursive: true, force: true }); continue; }
  fs.writeFileSync(f, src.replace(from, to));
  const code = runTest(d); fs.rmSync(d, { recursive: true, force: true });
  console.log((code !== 0 ? "KILLED  " : "SURVIVED ") + name); if (code === 0) bad++;
}
console.log(bad ? "MUTATION CHECK FAILED: " + bad : "MUTATION CHECK OK: " + MUTANTS.length + " mutants all killed, unmutated copy green");
process.exit(bad ? 1 : 0);
