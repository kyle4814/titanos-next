// F45: builds the 220-row SYNTHETIC ask-log fixture deterministically from the committed question sets (no real visitor data, no clock, no randomness).
// node --experimental-strip-types scripts/gen_ask_fixture.mjs [outdir]   (default: lib/concierge/fixtures)
import fs from "node:fs";
import { pathToFileURL } from "node:url";
const root = new URL("..", import.meta.url).pathname;
const R = (p) => import(pathToFileURL(root + p).href);
const { route } = await R("lib/concierge/router.ts");
const { INDEX } = await R("lib/concierge/catalogue.ts");
const { makeRow } = await R("lib/concierge/asklog.ts");
export const SALT = "SYNTHETIC-SALT-0000";
const PII = ["my email is jo.smith@example.com.au so ", "call me on 0412 345 678, ", "ABN 34 318 502 254: ", "ring (07) 3123 4567 about this: ", "+61 412 345 678 ", "it is for sam@acme.example, "];
export function build() {
  const qs = fs.readFileSync(root + "lib/concierge/questions.tsv", "utf8").split("\n").filter(Boolean).map((l) => l.split("\t"));
  const asks = qs.map(([seat, expected, q]) => ({ seat, expected, q }));
  for (let i = 0; i < 20; i++) { const b = asks[(i * 9) % asks.length]; asks.push({ seat: b.seat, expected: b.expected, q: PII[i % PII.length] + b.q }); }
  const rows = [], labels = [];
  asks.forEach((a, i) => {
    const reply = route(INDEX, a.q, a.seat);
    const ts = new Date(Date.UTC(2026, 0, 1) + i * 97000).toISOString();
    const row = makeRow({ salt: SALT, visitorId: "synthetic-visitor-" + (i % 37), question: a.q, reply, ts, synthetic: true });
    const got = row.intent;
    const answerable = got === a.expected ? "yes" : reply.kind === "ask" ? "partial" : "no";
    rows.push(row); labels.push({ ask_id: row.ask_id, correct_intent: a.expected, answerable });
  });
  return { rows, labels };
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = (process.argv[2] || root + "lib/concierge/fixtures").replace(/\/?$/, "/");
  fs.mkdirSync(out, { recursive: true });
  const { rows, labels } = build();
  fs.writeFileSync(out + "asks_SYNTHETIC_220.jsonl", rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  fs.writeFileSync(out + "labels_SYNTHETIC_220.tsv", "# SYNTHETIC: labels derived from the router's own expected intents on committed question sets. Not real visitors.\nask_id\tcorrect_intent\tanswerable\n" + labels.map((l) => [l.ask_id, l.correct_intent, l.answerable].join("\t")).join("\n") + "\n");
  console.log("wrote " + rows.length + " rows to " + out);
}
