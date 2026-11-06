// C9 status gate. Kill test: UNKNOWN never reads as UP, no percentage without a denominator, stale data is flagged, copy is clean.
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildStatus, STALE_MS } from "./gen_status.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const root = new URL("../", import.meta.url);
const R = (p) => readFileSync(new URL(p, root), "utf8");
const J = (p) => JSON.parse(R(p));
const DASH = /[–—]/;
const STATES = ["UP", "DOWN", "UNKNOWN"];
const NOW = Date.parse("2026-11-06T22:50:00+10:00");

// 1. schema of the committed data file
const d = J("public/data/status.json"), sample = J("lib/site-data/status-sample.json");
ok(d.dataset === "Status" && d.system && d.window && d.generatedAt && Array.isArray(d.components) && d.components.length >= 3, "status.json has dataset, system, window, generatedAt and components");
ok(d.components.every((c) => c.id && c.name && c.measures && STATES.includes(c.state) && typeof c.stale === "boolean" && Number.isInteger(c.up) && Number.isInteger(c.total) && c.window && "lastChecked" in c && "pct" in c), "every component has id, name, measures, state in UP/DOWN/UNKNOWN, window, counts and lastChecked");
ok(d.components.every((c) => c.up <= c.total), "no component has more passes than checks");
ok(sample.synthetic === true && /SYNTHETIC/.test(sample._note) && d.synthetic === true, "sample is labelled SYNTHETIC and the output inherits the label (no monitor input)");
ok(d.monitorInput.present === false && /no uptime samples/.test(d.monitorInput.reason), "absent monitor input is stated, not hidden");
const g = spawnSync("node", ["scripts/gen_status.mjs", "--check"], { cwd: root.pathname, encoding: "utf8" });
ok(g.status === 0, "public/data/status.json equals a fresh generation" + (g.stdout ? " :: " + g.stdout.trim() : ""));

// 2. behaviour with a fixed clock
const mk = (c) => buildStatus({ synthetic: true, system: "t", window: "w", components: [{ id: "a", name: "A", measures: "m", ...c }] }, [], NOW).components[0];
const fresh = "2026-11-06T20:00:00+10:00", old = "2026-11-04T20:00:00+10:00";
const none = mk({ up: 0, total: 0, lastChecked: null, lastResult: null });
ok(none.state === "UNKNOWN" && none.pct === null && none.note === "no data yet", "no samples: UNKNOWN, no percentage, 'no data yet'");
const noRes = mk({ up: 5, total: 5, lastChecked: fresh, lastResult: null });
ok(noRes.state === "UNKNOWN", "samples but no recorded result stays UNKNOWN, never UP");
const zeroDen = mk({ up: 3, total: 0, lastChecked: fresh, lastResult: "UP" });
ok(zeroDen.state === "UNKNOWN" && zeroDen.pct === null && zeroDen.up === 0, "zero denominator: UNKNOWN, no percentage, counts zeroed");
const up = mk({ up: 9, total: 10, lastChecked: fresh, lastResult: "UP" });
ok(up.state === "UP" && up.pct === 90 && !up.stale, "fresh UP with a denominator shows UP and a percentage of its own counts");
const dn = mk({ up: 9, total: 10, lastChecked: fresh, lastResult: "DOWN" });
ok(dn.state === "DOWN", "fresh DOWN shows DOWN");
const st = mk({ up: 9, total: 10, lastChecked: old, lastResult: "UP" });
ok(st.stale === true && st.state === "UNKNOWN" && st.lastKnown === "UP" && /STALE/.test(st.note), "data older than 24h is flagged STALE and is not shown as UP");
const edge = mk({ up: 1, total: 1, lastChecked: new Date(NOW - STALE_MS).toISOString(), lastResult: "UP" });
const edge2 = mk({ up: 1, total: 1, lastChecked: new Date(NOW - STALE_MS - 1000).toISOString(), lastResult: "UP" });
ok(!edge.stale && edge2.stale, "stale boundary is exactly 24 hours");
ok(d.components.every((c) => c.pct === null || c.total > 0), "committed data: a percentage never exists without a denominator");
ok(d.components.every((c) => !(c.stale && c.state === "UP")), "committed data: no STALE component reads UP");
ok(d.components.some((c) => c.total === 0 && c.state === "UNKNOWN"), "committed data keeps a no-data UNKNOWN row");

// 3. monitor ingest
const mon = buildStatus({ synthetic: true, system: "t", window: "w", components: [{ id: "a", name: "A", measures: "m", up: 0, total: 0, lastChecked: null, lastResult: null }] },
  [{ component: "a", at: "2026-11-06T21:00:00+10:00", ok: true }, { component: "a", at: "2026-11-06T21:30:00+10:00", ok: false }, { component: "zz", at: "2026-11-06T21:30:00+10:00", ok: true }], NOW);
ok(mon.synthetic === false && mon.monitorInput.present && mon.components[0].total === 2 && mon.components[0].up === 1 && mon.components[0].state === "DOWN" && mon.components[0].pct === 50, "monitor jsonl is merged: counts, latest result, label drops SYNTHETIC");

// 4. the page
const page = R("app/status/page.tsx");
ok(/public\/data\/status\.json/.test(page) && page.includes('href="/data/status.json"'), "page file cites its data file and links to it");
ok(/index:\s*false/.test(page), "page is noindex while the data is synthetic");
ok(page.includes("no data yet") && page.includes("data-status-stale") && page.includes("data-status-synthetic"), "page renders 'no data yet', the STALE flag and the SYNTHETIC banner");
ok(/c\.total > 0 && c\.pct !== null/.test(page) && page.includes("hasData(c) ?"), "percentage renders only when the denominator is above zero");
ok(!DASH.test(page) && !DASH.test(R("scripts/gen_status.mjs")) && !DASH.test(JSON.stringify(d)) && !DASH.test(JSON.stringify(sample)), "zero em or en dashes in page, generator and data");
const lit = [...page.matchAll(/>([^<>{}]*\d[^<>{}]*)</g)].map((m) => m[1]);
ok(lit.length === 0, "page has no hand-typed figure in its JSX text" + (lit.length ? " :: " + lit.join("|") : ""));

// 5. trust links to status
const trust = J("lib/site-data/trust.json"), ts = trust.sections.find((s) => s.id === "status");
ok(ts.links.some(([h]) => h === "/status"), "/trust status section links to /status");
ok(/uptime is UNKNOWN/.test(ts.body) && !/not built yet/.test(ts.body) && !/\d\s*%/.test(ts.body), "/trust says uptime is UNKNOWN with the honest reason, no invented figure, no 'not built' line");
ok(!DASH.test(JSON.stringify(trust)), "trust copy has zero dashes");

// 6. content_lint on the page copy and the trust status body (skips with a visible note if the lint tool is absent)
const LINT = "/home/tech2/klinge-kernel/bin/content_lint.py";
if (existsSync(LINT)) {
  const dir = mkdtempSync(join(tmpdir(), "statuslint-"));
  const body = [ts.body, "SYNTHETIC SAMPLE. The rows below are invented to show the format. They are not measurements of TITANOS. No uptime figure is claimed.",
    ...d.components.map((c) => `${c.name}: ${c.state}${c.stale ? " STALE" : ""}. ${c.measures}. ` + (c.total > 0 ? `${c.window}: ${c.up} of ${c.total} checks passed (${c.pct}%). Source: synthetic sample.` : "no data yet"))].join("\n\n");
  const f = join(dir, "status.txt"); writeFileSync(f, body);
  const lint = spawnSync("python3", [LINT, "--no-cta", "--figures", f], { encoding: "utf8" });
  ok(lint.status === 0, "content_lint --no-cta --figures CLEAN on status copy" + (lint.status ? " :: " + (lint.stdout + lint.stderr).trim().slice(0, 300) : ""));
} else console.log("SKIP content_lint (tool absent at " + LINT + ")");

// 7. built layer
const bi = process.argv.indexOf("--built");
if (bi > 0) {
  const html = readFileSync(join(process.argv[bi + 1], "status.html"), "utf8");
  ok(/data-status-synthetic/.test(html) && /noindex/.test(html), "built /status shows the SYNTHETIC banner and is noindex");
  ok(!/data-status-state="UP"[^>]*>[^<]*<strong>UP<\/strong>[^<]*<strong[^>]*data-status-stale/.test(html), "built /status has no STALE UP");
  ok(!readFileSync(join(process.argv[bi + 1], "sitemap.xml"), "utf8").includes("/status"), "sitemap.xml does not list the noindex /status");
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
