// Tests for scripts/no_model_import_graph.mjs. node --experimental-strip-types scripts/test_no_model_import_graph.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runGate, scanSource } from "./no_model_import_graph.mjs";

const real = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0, passed = 0;
const ok = (c, m) => { if (c) passed++; else { fails++; console.error("FAIL " + m); } };
const put = (root, rel, body) => { mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); writeFileSync(path.join(root, rel), body); };

// 1 the real tree is clean and the report lists entries and edges
const r = runGate({ root: real });
ok(r.ok && r.violations.length === 0, `real tree clean ${JSON.stringify(r.violations)}`);
ok(r.entriesWalked >= 50 && r.filesWalked >= 100 && r.edgesFollowed >= 100, `walk is non-trivial (${r.entriesWalked}/${r.filesWalked}/${r.edgesFollowed})`);
ok(["portal-api/src/index.ts", "app/scan/page.tsx", "app/shop/page.tsx", "app/status/page.tsx"].every((e) => r.entries.includes(e)), "entries include worker, scan, shop, status");
ok(r.entries.some((e) => e.startsWith("lib/concierge/")), "entries include concierge");
ok(r.unresolved.length === 0, `no unresolved local imports ${r.unresolved}`);
ok(r.staleAllow.length === 0, "no stale allowlist entries in the real tree");

// 2 prose and non-URL mentions do not trip
ok(scanSource('export const bots = ["anthropic-ai", "GPTBot"]; // calls api.openai.com in a comment').hosts.length === 0, "bot UA string and comment ignored");
ok(scanSource('export default () => <p>We never call anthropic.com or OpenAI on the guest path</p>;').hosts.length === 0, "JSX prose ignored");
ok(scanSource('const t = "Powered by api.openai.com models";').hosts.length === 0, "sentence containing a host is prose, not a target");
ok(scanSource('const u = "https://cloudflare-dns.com/dns-query"; import x from "react";').hosts.length === 0, "benign host and import pass");

// 3 detection
ok(scanSource('const u = `https://api.anthropic.com/v1/messages`;').hosts[0] === "api.anthropic.com", "template URL host caught");
ok(scanSource("fetch('https://bedrock-runtime.us-east-1.amazonaws.com/model')").hosts.length === 1, "bedrock caught");
ok(scanSource('const H = "api.openai.com";').hosts.length === 1, "bare host string caught");
ok(scanSource('const m = await import("@anthropic-ai/sdk");').sdk[0] === "@anthropic-ai/sdk", "dynamic SDK import caught");

// 4 planted fixture two hops deep: caught, with the chain; allowlisted passes; removing the entry flips it
const root = mkdtempSync(path.join(tmpdir(), "f433-"));
try {
  put(root, "package.json", '{"type":"module"}');
  put(root, "app/scan/page.tsx", 'import { a } from "@/lib/a";\nexport default () => a;');
  put(root, "lib/a.ts", 'import { b } from "./b.ts";\nexport const a = b;');
  put(root, "lib/b.ts", 'import OpenAI from "openai";\nexport const b = new OpenAI();');
  put(root, "portal-api/src/index.ts", "export default {};");
  const allowFile = path.join(root, "scripts/no_model_allowlist.json");
  put(root, "scripts/no_model_allowlist.json", '{"entries":[]}');
  const bad = runGate({ root });
  ok(!bad.ok && bad.violations.length === 1 && bad.violations[0].file === "lib/b.ts" && bad.violations[0].kind === "sdk", "SDK two hops deep is caught");
  ok(bad.violations[0].chain.join(">") === "app/scan/page.tsx>lib/a.ts>lib/b.ts", `violation carries the import chain (${bad.violations[0].chain})`);
  put(root, "scripts/no_model_allowlist.json", JSON.stringify({ entries: [{ path: "lib/b.ts", kind: "sdk", match: "openai", reason: "fixture: reviewed owner-only tool" }] }));
  const al = runGate({ root });
  ok(al.ok && al.allowed.length === 1 && al.allowed[0].reason.includes("fixture"), "allowlisted entry passes and is reported with its reason");
  put(root, "scripts/no_model_allowlist.json", '{"entries":[]}');
  ok(!runGate({ root }).ok, "removing the allowlist entry flips it back to FAILED");
  // an entry without a reason is rejected
  put(root, "scripts/no_model_allowlist.json", '{"entries":[{"path":"lib/b.ts","kind":"sdk","match":"openai"}]}');
  let threw = false; try { runGate({ root }); } catch { threw = true; }
  ok(threw, "allowlist entry with no reason is refused");
  // a stale entry is reported
  put(root, "lib/b.ts", "export const b = 1;");
  put(root, "scripts/no_model_allowlist.json", JSON.stringify({ entries: [{ path: "lib/b.ts", kind: "sdk", match: "openai", reason: "x" }] }));
  ok(runGate({ root }).staleAllow.length === 1, "stale allowlist entry reported");
  // host reference in an unreachable file is not a violation (only the import graph counts)
  put(root, "lib/orphan.ts", 'export const u = "https://api.anthropic.com/v1";');
  ok(runGate({ root }).ok, "unreachable module is not walked");
  put(root, "lib/b.ts", 'export const b = "https://api.anthropic.com/v1/messages";');
  put(root, "scripts/no_model_allowlist.json", '{"entries":[]}');
  ok(runGate({ root }).violations[0]?.kind === "host", "model-host URL two hops deep is caught");
} finally { rmSync(root, { recursive: true, force: true }); }

// 5 mutants: CLI exit code and report file
{
  const { spawnSync } = await import("node:child_process");
  const rep = path.join(tmpdir(), `f433rep-${process.pid}.json`);
  const p = spawnSync(process.execPath, ["--experimental-strip-types", path.join(real, "scripts/no_model_import_graph.mjs"), "--report", rep], { encoding: "utf8" });
  ok(p.status === 0 && /no_model_import_graph: OK/.test(p.stdout), "CLI exits 0 on the real tree");
  const j = JSON.parse(readFileSync(rep, "utf8"));
  ok(Array.isArray(j.entries) && j.edgesFollowed > 0 && "violations" in j, "JSON report lists entries and edges followed");
  rmSync(rep, { force: true });
}
console.log(`test_no_model_import_graph: ${passed} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
