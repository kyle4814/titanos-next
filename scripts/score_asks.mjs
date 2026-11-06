// F45 CLI: node --experimental-strip-types scripts/score_asks.mjs <asks.jsonl> <labels.tsv>
// Exit 0 PASS, 1 FAIL, 3 INSUFFICIENT SAMPLE, 2 bad input. Reads files only; no network, no writes.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
const root = new URL("..", import.meta.url).pathname;
const { parseAskJsonl } = await import(pathToFileURL(root + "lib/concierge/asklog.ts").href);
const { parseLabels, score, render } = await import(pathToFileURL(root + "lib/concierge/askscore.ts").href);
const [logPath, labelPath, ...extra] = process.argv.slice(2);
if (!logPath || !labelPath || extra.length) { console.error("usage: score_asks.mjs <asks.jsonl> <labels.tsv>"); process.exit(2); }
try {
  const s = score(parseAskJsonl(fs.readFileSync(logPath, "utf8"), logPath), parseLabels(fs.readFileSync(labelPath, "utf8"), labelPath));
  console.log(render(s));
  process.exit(s.verdict === "PASS" ? 0 : s.verdict === "FAIL" ? 1 : 3);
} catch (e) { console.error("ERROR: " + e.message); process.exit(2); }
