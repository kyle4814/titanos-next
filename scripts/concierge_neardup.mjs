// C6 near-duplicate offer fixture (F80). lib/concierge/neardup.tsv: 34 synthetic pairs of sibling offers, written from the catalogue
// (offer ids, titles, keywords) WITHOUT opening holdout.tsv. Per pair: one ambiguous ask (expect ask) and one clear ask per shelf (expect that shelf).
// Metrics: raise recall (ambiguous -> ask), false-raise rate (clear -> ask), clear accuracy. Wilson 95%. 0 model calls, 0 network, 0 random trapped.
import fs from "node:fs";
import { index } from "./concierge_eval.mjs";
import { pathToFileURL } from "node:url";
import { wilson } from "./concierge_holdout.mjs";
const root = new URL("..", import.meta.url).pathname;
const { route } = await import(pathToFileURL(root + "lib/concierge/router.ts").href);
export const neardup = fs.readFileSync(root + "lib/concierge/neardup.tsv", "utf8").split("\n").filter(Boolean).map((l, i) => {
  const [pair, seat, expect, q] = l.split("\t");
  return { i, pair, seat, expect, q, kind: expect === "ask" ? "ambiguous" : "clear" };
});
export function runNearDup(routeFn = route) {
  const realFetch = globalThis.fetch, realRandom = Math.random;
  let calls = 0;
  globalThis.fetch = () => { calls++; throw new Error("network forbidden"); };
  Math.random = () => { calls++; return 0.5; };
  try {
    const res = neardup.map((x) => {
      const r = routeFn(index, x.q, x.seat);
      const got = r.kind === "match" ? r.shelf.id : r.kind === "unmatched" ? "none" : "ask";
      return { ...x, got, ok: got === x.expect, taps: r.kind === "ask" ? r.taps.map((t) => t.shelfId) : [] };
    });
    return { res, calls, ...summarise(res) };
  } finally { globalThis.fetch = realFetch; Math.random = realRandom; }
}
export function summarise(res) {
  const amb = res.filter((r) => r.kind === "ambiguous"), clr = res.filter((r) => r.kind === "clear");
  const raised = amb.filter((r) => r.got === "ask").length;
  const falseRaise = clr.filter((r) => r.got === "ask").length;
  const clearOk = clr.filter((r) => r.ok).length;
  return { nAmb: amb.length, nClear: clr.length, raised, falseRaise, clearOk };
}
const pct = (k, n) => (100 * k / n).toFixed(1) + "%";
const ci = (k, n) => { const [a, b] = wilson(k, n); return `[${(100 * a).toFixed(1)}%, ${(100 * b).toFixed(1)}%]`; };
if (process.argv[1] && process.argv[1].split("/").pop() === "concierge_neardup.mjs") {
  const o = runNearDup();
  console.log(`near-dup fixture: ${neardup.length} rows, ${o.nAmb} ambiguous, ${o.nClear} clear, ${new Set(neardup.map((x) => x.pair)).size} pairs, calls trapped ${o.calls}`);
  console.log(`raise recall   ${o.raised}/${o.nAmb} = ${pct(o.raised, o.nAmb)} ${ci(o.raised, o.nAmb)}`);
  console.log(`false-raise    ${o.falseRaise}/${o.nClear} = ${pct(o.falseRaise, o.nClear)} ${ci(o.falseRaise, o.nClear)}`);
  console.log(`clear correct  ${o.clearOk}/${o.nClear} = ${pct(o.clearOk, o.nClear)} ${ci(o.clearOk, o.nClear)}`);
  if (process.argv.includes("--misses")) for (const r of o.res.filter((r) => !r.ok)) console.log(`${r.pair} exp=${r.expect} got=${r.got} ${r.kind === "ambiguous" ? "" : r.taps.join(",")}`);
}
