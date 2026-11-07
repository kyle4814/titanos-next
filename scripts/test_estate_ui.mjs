// /enterprise#estate UI: source contract, view-model behaviour, typed errors, mutations. SYNTHETIC rows only.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const R = (p) => new URL(`../${p}`, import.meta.url);
const read = (p) => fs.readFileSync(R(p), "utf8");
const NOW = Date.UTC(2026, 10, 7, 0, 0, 0), M = 60_000;

async function suite(vm, comp, anchorsSrc, seatSrc, label) {
  let fail = 0;
  const ok = (c, m) => { if (!c) { fail++; if (label === "real") console.log(`FAIL ${m}`); } else if (label === "real") console.log(`PASS ${m}`); };
  const { buildEstateView, CACHE_TTL_MS, SAMPLE_ESTATE, SAMPLE_NOW } = vm;
  // source contract
  ok(/from "@\/lib\/estate-ui"/.test(comp), "component imports the view-model");
  ok(/view\.summary\[g\]/.test(comp) && /Grade \$\{g\}/.test(comp) && /view\.summary\.stale/.test(comp), "component renders the grade summary");
  ok(/r\.grade/.test(comp) && /r\.owner/.test(comp), "component renders grade and owner per row");
  ok(/view\.method/.test(comp) && /Public DNS reads only, nothing is touched/.test(vm.__src), "component renders the method line from the view-model");
  ok(/<strong>\{SYNTHETIC_LABEL\}<\/strong>/.test(comp) && /made-up domains/.test(vm.__src), "component renders the synthetic example label");
  ok(/r\.stale/.test(comp) && /out of date/.test(comp), "component renders the stale flag");
  ok(/role="alert"/.test(comp) && /view\.message/.test(comp), "component renders the typed error message");
  ok(!/fetch\(|XMLHttpRequest|sendBeacon|mailto:|smtp|WebSocket/i.test(comp + vm.__src), "no network, scan or send path");
  ok(/status: "live"/.test((anchorsSrc.split('id: "estate"')[1] || "").split('id: "dossiers"')[0]), "estate anchor is live (built)");
  ok(/<EstateView \/>/.test(seatSrc), "SeatAnchors wires the component into the estate section");
  // sort: worst grade first, unknown last, then domain
  const v = buildEstateView(SAMPLE_ESTATE, SAMPLE_NOW);
  ok(v.ok && v.rows.map((r) => r.grade).join(",") === "F,C,B,A,UNKNOWN", "sorted worst grade first, not-read last");
  const tie = buildEstateView([{ domain: "b.x", grade: "A", scannedAt: NOW }, { domain: "a.x", grade: "A", scannedAt: NOW }, { domain: "z.x", grade: "F", scannedAt: NOW }], NOW);
  ok(tie.ok && tie.rows.map((r) => r.domain).join() === "z.x,a.x,b.x", "ties break by domain");
  // summary
  ok(v.ok && v.summary.total === 5 && v.summary.F === 1 && v.summary.C === 1 && v.summary.B === 1 && v.summary.A === 1 && v.summary.UNKNOWN === 1 && v.summary.D === 0, "grade counts");
  ok(v.ok && v.summary.stale === 2, "stale count (one old scan, one never scanned)");
  ok(v.ok && v.method === "Public DNS reads only, nothing is touched.", "method line");
  // stale boundary
  ok(CACHE_TTL_MS === 15 * M, "TTL is the cache default of 15 minutes");
  const at = (age) => buildEstateView([{ domain: "a.x", grade: "A", scannedAt: NOW - age }], NOW);
  ok(at(CACHE_TTL_MS).rows[0].stale === false, "exactly the TTL is not stale");
  ok(at(CACHE_TTL_MS + 1).rows[0].stale === true, "one ms past the TTL is stale");
  ok(at(CACHE_TTL_MS - 1).rows[0].stale === false, "just under the TTL is fresh");
  ok(at(-5 * M).rows[0].ageMinutes === 0, "a scan time in the future shows 0 minutes, never negative");
  // empty
  const e = buildEstateView([], NOW);
  ok(e.ok && e.empty && e.rows.length === 0 && /No domains/.test(e.emptyText) && e.summary.total === 0, "empty estate gives a plain empty state");
  // typed errors
  const E = (r, code) => ok(r.ok === false && r.code === code && r.message.length > 10 && !/NaN|undefined|null/.test(r.message), `typed error ${code}`);
  E(buildEstateView({}, NOW), "NOT_A_LIST");
  E(buildEstateView(undefined, NOW), "NOT_A_LIST");
  E(buildEstateView([{ domain: "", grade: "A" }], NOW), "BAD_ROW");
  E(buildEstateView([{ grade: "A" }], NOW), "BAD_ROW");
  E(buildEstateView([{ domain: "a.x", grade: "Z" }], NOW), "BAD_ROW");
  E(buildEstateView([{ domain: "a.x", grade: "A", scannedAt: "yesterday" }], NOW), "BAD_ROW");
  E(buildEstateView([{ domain: "a.x", grade: "A", scannedAt: NaN }], NOW), "BAD_ROW");
  E(buildEstateView([{ domain: "a.x", grade: "A", owner: 7 }], NOW), "BAD_ROW");
  E(buildEstateView([null], NOW), "BAD_ROW");
  E(buildEstateView([[]], NOW), "BAD_ROW");
  E(buildEstateView([], NaN), "BAD_NOW");
  const bad = buildEstateView([{ domain: "a.x", grade: "A", scannedAt: NOW }, { domain: "b.x", grade: 5 }], NOW);
  ok(bad.ok === false && /Row 2/.test(bad.message), "error names the offending row");
  const grp = buildEstateView([{ domain: "A.X", grade: "B", scannedAt: NOW, group: "Grp" }, { domain: "b.x", grade: "B", scannedAt: NOW }], NOW);
  ok(grp.ok && grp.rows[0].owner === "Grp" && grp.rows[0].domain === "a.x" && grp.rows[1].owner === "Unassigned", "group falls back as owner, domain lower-cased, missing owner shown as Unassigned");
  return fail;
}

const mod = async (dir) => { const m = await import(pathToFileURL(path.join(dir, "estate-ui.ts")).href); return { ...m, __src: fs.readFileSync(path.join(dir, "estate-ui.ts"), "utf8") }; };
const libDir = path.dirname(new URL(R("lib/estate-ui.ts")).pathname);
const real = await mod(libDir);
let fail = await suite(real, read("components/EstateView.tsx"), read("app/enterprise/anchors.ts"), read("components/SeatAnchors.tsx"), "real");

// mutations: each must fail the suite
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "estateui-"));
const vmSrc = read("lib/estate-ui.ts"), compSrc = read("components/EstateView.tsx"), aSrc = read("app/enterprise/anchors.ts"), sSrc = read("components/SeatAnchors.tsx");
let n = 0;
async function mutant(name, { vm = vmSrc, comp = compSrc, a = aSrc, s = sSrc }) {
  if (vm === vmSrc && comp === compSrc && a === aSrc && s === sSrc) { console.log(`FAIL mutant did not apply: ${name}`); fail++; return; }
  const d = path.join(tmp, `m${n++}`); fs.mkdirSync(d); fs.writeFileSync(path.join(d, "estate-ui.ts"), vm);
  let f; try { f = await suite(await mod(d), comp, a, s, "mutant"); } catch { f = 1; }
  console.log(`${f > 0 ? "PASS" : "FAIL"} mutant killed: ${name}`); if (!(f > 0)) fail++;
}
await mutant("drop the stale flag", { vm: vmSrc.replace("age === null ? true : age > ttlMs", "false") });
await mutant("stale off by one (>=)", { vm: vmSrc.replace("age > ttlMs", "age >= ttlMs") });
await mutant("mis-sort (best grade first)", { vm: vmSrc.replace("rank(a.grade) - rank(b.grade)", "rank(b.grade) - rank(a.grade)") });
await mutant("drop the synthetic label", { comp: compSrc.replace("<strong>{SYNTHETIC_LABEL}</strong>", "") });
await mutant("drop the method line", { comp: compSrc.replace("{view.method}", "") });
await mutant("drop the grade summary", { comp: compSrc.replace("view.summary[g]", "0") });
await mutant("swallow malformed rows", { vm: vmSrc.replace('if (typeof r.domain !== "string" || !r.domain.trim()) return bad("the domain is missing");', "") });
await mutant("anchor flipped back to coming", { a: aSrc.replace('title: "Estate view", status: "live"', 'title: "Estate view", status: "coming"') });
await mutant("component unwired", { s: sSrc.replace("<EstateView />", "") });
fs.rmSync(tmp, { recursive: true, force: true });

// client copy lint
const lint = "/home/tech2/klinge-kernel/bin/content_lint.py";
const copyOnly = [...(vmSrc + compSrc + aSrc).matchAll(/"([A-Z][^"]{20,})"|>([A-Z][^<{]{20,})</g)].map((m) => m[1] || m[2]).join("\n\n");
lint_block: {
  if (!fs.existsSync(lint)) { console.log("NOTE content_lint absent, lint skipped"); break lint_block; }
  const t = fs.mkdtempSync(path.join(os.tmpdir(), "estateui-lint-")); const f = path.join(t, "copy.txt"); fs.writeFileSync(f, copyOnly + "\n");
  const r = spawnSync("python3", [lint, "--no-cta", f], { encoding: "utf8" });
  console.log(`${r.status === 0 ? "PASS" : "FAIL"} content_lint --no-cta CLEAN${r.status ? " :: " + (r.stdout + r.stderr).slice(0, 300) : ""}`);
  if (r.status !== 0) fail++; fs.rmSync(t, { recursive: true, force: true });
}
for (const p of ["lib/estate-ui.ts", "components/EstateView.tsx", "app/enterprise/anchors.ts", "components/SeatAnchors.tsx"]) {
  const bad = /[–—]/.test(read(p)); console.log(`${bad ? "FAIL" : "PASS"} no em or en dash in ${p}`); if (bad) fail++;
}
console.log(fail ? `FAIL ${fail}` : "estate-ui: all green");
process.exit(fail ? 1 : 0);
