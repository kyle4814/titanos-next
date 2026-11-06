// F45 tests: ask log privacy + scorer verdict. Everything here is SYNTHETIC; no real visitor data, no network.
// ASKLOG_ROOT lets scripts/mutate_ask_log_scorer.mjs run this same file against a mutated copy.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const root = process.env.ASKLOG_ROOT ? process.env.ASKLOG_ROOT.replace(/\/?$/, "/") : new URL("..", import.meta.url).pathname;
const R = (p) => import(pathToFileURL(root + p).href);
const A = await R("lib/concierge/asklog.ts");
const S = await R("lib/concierge/askscore.ts");
const { route } = await R("lib/concierge/router.ts");
const { INDEX } = await R("lib/concierge/catalogue.ts");
let pass = 0, fail = 0;
const t = (name, ok, extra = "") => { if (ok) pass++; else { fail++; console.log("FAIL " + name + " " + extra); } };
const throws = (f) => { try { f(); return false; } catch { return true; } };
const SALT = "SYNTHETIC-test-salt-123";

// (1) PII scrub (SYNTHETIC strings)
const SCRUB = [
  ["email jo.smith@example.com.au please", /\[EMAIL\]/, /jo\.smith|example/],
  ["mail me: SAM@Acme.Example", /\[EMAIL\]/, /acme/i],
  ["jo (at) example (dot) com", /\[EMAIL\]/, /example/],
  ["my mobile is 0412 345 678", /\[PHONE\]/, /0412|345/],
  ["0412345678 thanks", /\[PHONE\]/, /0412/],
  ["+61 412 345 678", /^\[PHONE\]$/, /61|412/],
  ["+61412345678", /\[PHONE\]/, /412345/],
  ["call (07) 3123 4567", /\[PHONE\]/, /3123|4567/],
  ["07 3123 4567", /\[PHONE\]/, /3123/],
  ["1300 123 456 is that you", /\[PHONE\]/, /1300|123 456/],
  ["+44 20 7946 0958", /\[PHONE\]/, /7946/],
  ["ABN 34 318 502 254", /\[ABN\]/, /318|502/],
  ["abn: 34318502254", /\[ABN\]/, /318502/],
  ["our number 34 318 502 254", /\[ABN\]/, /318 502/],
  ["card 4111 1111 1111 1111", /\[NUMBER\]/, /4111/],
  ["ref 12345678 here", /\[NUMBER\]/, /12345678/],
];
for (const [inp, want, bad] of SCRUB) { const o = A.scrubPii(inp); t("scrub: " + inp, want.test(o) && !bad.test(o), JSON.stringify(o)); }
for (const keep of ["what does the scan cost", "check acme.com.au please", "I have 25 staff and 3 offices", "AU$149/month for the monitor", "is 2026 a good year", "what's the price?"])
  t("scrub keeps ordinary text: " + keep, A.scrubPii(keep) === keep, A.scrubPii(keep));
t("scrub caps length", A.scrubPii("a ".repeat(500)).length <= A.MAX_Q);
t("scrub is idempotent", ["jo@x.com.au 0412 345 678 ABN 34 318 502 254", "plain"].every((s) => A.scrubPii(A.scrubPii(s)) === A.scrubPii(s)));

// (2) row shape: salted hash, no IP, no raw id, no PII
const rep = route(INDEX, "how do I prove it stayed fixed", "guest");
const row = A.makeRow({ salt: SALT, visitorId: "visitor-1", question: "ring 0412 345 678: how do I prove it stayed fixed", reply: rep, ts: "2026-01-01T00:00:00.000Z" });
t("row keys are exactly the schema", Object.keys(row).sort().join() === "ask_id,conf,intent,q,ts,visitor", Object.keys(row).join());
t("row has no ip field", !("ip" in row) && !/ip|addr/i.test(Object.keys(row).join()));
t("visitor is a 16 hex salted hash, not the raw id", /^[0-9a-f]{16}$/.test(row.visitor) && !JSON.stringify(row).includes("visitor-1"));
t("salt changes the hash", A.hashVisitor(SALT, "v") !== A.hashVisitor(SALT + "x", "v") && A.hashVisitor(SALT, "v") === A.hashVisitor(SALT, "v"));
t("different visitors differ", A.hashVisitor(SALT, "v1") !== A.hashVisitor(SALT, "v2"));
t("short or missing salt refused", throws(() => A.hashVisitor("short", "v")) && throws(() => A.hashVisitor("", "v")) && throws(() => A.hashVisitor(undefined, "v")));
t("salt never appears in the row", !JSON.stringify(row).includes(SALT));
t("q was scrubbed before storage", row.q.includes("[PHONE]") && !/0412/.test(JSON.stringify(row)));
t("intent and conf come from the reply", row.intent === rep.shelf.id && row.conf === Math.round(rep.score * 100) / 100);
const none = A.makeRow({ salt: SALT, visitorId: "v", question: "how do I bake sourdough", reply: route(INDEX, "how do I bake sourdough", "guest"), ts: "2026-01-01T00:00:00.000Z" });
t("unmatched ask stored with intent none", none.intent === "none" && none.conf === 0);
const junk = A.makeRow({ salt: SALT, visitorId: "v", question: "<script>alert(1)</script>", reply: route(INDEX, "<script>alert(1)</script>", "guest"), ts: "2026-01-01T00:00:00.000Z" });
t("junk ask keeps no text", junk.intent === "junk" && junk.q === "" && !/script|alert/.test(JSON.stringify(junk)));
t("ask_id is stable and 12 hex", /^[0-9a-f]{12}$/.test(row.ask_id) && row.ask_id === A.makeRow({ salt: SALT, visitorId: "visitor-1", question: "ring 0412 345 678: how do I prove it stayed fixed", reply: rep, ts: "2026-01-01T00:00:00.000Z" }).ask_id);

// (3) validateRow refuses anything outside the schema
t("validate accepts a good row", !throws(() => A.validateRow(row)));
t("validate refuses an ip field", throws(() => A.validateRow({ ...row, ip: "203.0.113.9" })));
t("validate refuses a raw user agent", throws(() => A.validateRow({ ...row, ua: "x" })));
t("validate refuses an unhashed visitor", throws(() => A.validateRow({ ...row, visitor: "visitor-1" })));
t("validate refuses a q with an email", throws(() => A.validateRow({ ...row, q: "write to jo@example.com.au" })));
t("validate refuses a q with a phone", throws(() => A.validateRow({ ...row, q: "call 0412 345 678" })));
t("validate refuses a bad ts and bad conf", throws(() => A.validateRow({ ...row, ts: "nope" })) && throws(() => A.validateRow({ ...row, conf: NaN })));

// (4) adapters
const mem = new A.MemoryAskLog();
t("recordAsk stores via memory adapter", (await A.recordAsk(mem, { salt: SALT, visitorId: "v", question: "scan my site", reply: route(INDEX, "scan my site", "guest"), ts: "2026-01-01T00:00:00.000Z" })) === true && mem.rows.length === 1);
t("recordAsk reports false when the adapter throws and does not throw", (await A.recordAsk({ append() { throw new Error("disk"); }, all: () => [] }, { salt: SALT, visitorId: "v", question: "q", reply: rep, ts: "2026-01-01T00:00:00.000Z" })) === false);
t("recordAsk refuses a short salt without throwing", (await A.recordAsk(mem, { salt: "x", visitorId: "v", question: "q", reply: rep, ts: "2026-01-01T00:00:00.000Z" })) === false && mem.rows.length === 1);
t("memory adapter refuses an ip row", throws(() => mem.append({ ...row, ip: "1.2.3.4" })));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "asklog-"));
if (!tmp.startsWith(os.tmpdir())) throw new Error("bad tmp");
const jf = path.join(tmp, "asks.jsonl");
const jl = new A.JsonlAskLog(jf);
jl.append(row); jl.append(none);
t("jsonl adapter round-trips", jl.all().length === 2 && jl.all()[0].ask_id === row.ask_id);
t("jsonl file holds no ip, no raw id, no phone", !/"ip"|visitor-1|0412/.test(fs.readFileSync(jf, "utf8")));
t("jsonl adapter refuses an ip row and writes nothing", throws(() => jl.append({ ...row, ip: "1.2.3.4" })) && fs.readFileSync(jf, "utf8").split("\n").filter(Boolean).length === 2);
t("reader refuses a poisoned file with a line number", throws(() => A.parseAskJsonl(JSON.stringify({ ...row, ip: "1.2.3.4" }) + "\n")) && /line 1/.test((() => { try { A.parseAskJsonl("{bad"); } catch (e) { return e.message; } })()));
t("missing file reads as empty", A.readAskJsonl(path.join(tmp, "none.jsonl")).length === 0);

// (5) scorer on the committed SYNTHETIC 220 fixture
const FX = root + "lib/concierge/fixtures/";
const rows = A.parseAskJsonl(fs.readFileSync(FX + "asks_SYNTHETIC_220.jsonl", "utf8"));
const labels = S.parseLabels(fs.readFileSync(FX + "labels_SYNTHETIC_220.tsv", "utf8"));
t("fixture has 220 rows, all flagged synthetic", rows.length === 220 && rows.every((r) => r.synthetic === true));
t("fixture rows are PII free and carry no ip", !/@|0412|345 678|318 502|"ip"/.test(fs.readFileSync(FX + "asks_SYNTHETIC_220.jsonl", "utf8")) && rows.some((r) => /\[EMAIL\]/.test(r.q)) && rows.some((r) => /\[PHONE\]/.test(r.q)) && rows.some((r) => /\[ABN\]/.test(r.q)));
t("fixture labels file says SYNTHETIC", /SYNTHETIC/.test(fs.readFileSync(FX + "labels_SYNTHETIC_220.tsv", "utf8").split("\n")[0]));
const s = S.score(rows, labels);
t("fixture: 220 labelled, verdict PASS", s.labelled === 220 && s.verdict === "PASS" && s.synthetic === true, JSON.stringify([s.labelled, s.verdict]));
t("fixture: counts add up", s.yes + s.partial + s.no === 220 && s.unanswered.length === s.no);
t("fixture: answer rate is yes/labelled", Math.abs(s.answerRate - s.yes / 220) < 1e-12 && Math.abs(s.partialRate - s.partial / 220) < 1e-12);
t("fixture: unanswered rows carry their text and routing", s.unanswered.every((u) => typeof u.q === "string" && u.intent && u.correct_intent));
const out = S.render(s);
t("render says SYNTHETIC, prints rate, sample size, unanswered and verdict", /SYNTHETIC/.test(out) && /answer rate/.test(out) && /n=220/.test(out) && /unanswered \(\d+\)/.test(out) && /VERDICT: PASS/.test(out));
t("render has no em or en dash", !/[–—]/.test(out));

// (6) sample-size refusal and the 80% boundary, built from synthetic rows
const mk = (n, yesN, partialN = 0) => {
  const rs = [], ls = [];
  for (let i = 0; i < n; i++) {
    const r = A.makeRow({ salt: SALT, visitorId: "v" + i, question: "synthetic ask number " + i, reply: rep, ts: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString(), synthetic: true });
    rs.push(r); ls.push({ ask_id: r.ask_id, correct_intent: rep.shelf.id, answerable: i < yesN ? "yes" : i < yesN + partialN ? "partial" : "no" });
  }
  return S.score(rs, ls);
};
t("MIN_SAMPLE is 200", S.MIN_SAMPLE === 200);
t("199 labelled, all yes: INSUFFICIENT SAMPLE, no verdict", mk(199, 199).verdict === "INSUFFICIENT SAMPLE");
t("0 labelled: INSUFFICIENT SAMPLE, rate null", (() => { const x = S.score([], []); return x.verdict === "INSUFFICIENT SAMPLE" && x.answerRate === null; })());
t("200 labelled at 160 yes (80.0%): PASS", mk(200, 160).verdict === "PASS");
t("200 labelled at 159 yes (79.5%): FAIL", mk(200, 159).verdict === "FAIL");
t("partial is not counted as an answer", mk(200, 150, 50).verdict === "FAIL" && mk(200, 150, 50).partial === 50);
t("200 all no: FAIL", mk(200, 0).verdict === "FAIL");
t("PASS at 160/200 flags the interval lower bound below 80%", mk(200, 160).lowerBoundBelowTarget === true && mk(200, 200).lowerBoundBelowTarget === false);
t("render of a short sample prints INSUFFICIENT SAMPLE and no VERDICT line", (() => { const o = S.render(mk(150, 150)); return /INSUFFICIENT SAMPLE/.test(o) && !/VERDICT:/.test(o); })());
t("logged rows beyond the labelled set do not count toward the 200", (() => { const rs = [], ls = []; for (let i = 0; i < 300; i++) { const r = A.makeRow({ salt: SALT, visitorId: "v" + i, question: "ask " + i, reply: rep, ts: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString() }); rs.push(r); if (i < 100) ls.push({ ask_id: r.ask_id, correct_intent: "x", answerable: "yes" }); } const x = S.score(rs, ls); return x.verdict === "INSUFFICIENT SAMPLE" && x.logged === 300 && x.labelled === 100 && x.unlabelled === 200; })());
t("real (non-synthetic) data does not print the SYNTHETIC banner", (() => { const r = A.makeRow({ salt: SALT, visitorId: "v", question: "real-shaped ask", reply: rep, ts: "2026-01-01T00:00:00.000Z" }); return !/SYNTHETIC/.test(S.render(S.score([r], []))); })());
const okRow = rows[0];
t("score refuses a label with no log row, naming the cause", (() => { try { S.score(rows, [{ ask_id: "000000000000", correct_intent: "x", answerable: "yes" }]); } catch (e) { return /no row in the log/.test(e.message); } return false; })());
t("score refuses duplicate labels", throws(() => S.score(rows, [labels[0], labels[0]])));
t("score refuses duplicate log ids", throws(() => S.score([okRow, okRow], [])));

// (7) label file format
const H = "ask_id\tcorrect_intent\tanswerable\n";
t("labels parse with comments and blanks", S.parseLabels("# c\n\n" + H + "aaaaaaaaaaaa\tportal:scan\tyes\n").length === 1);
t("labels refuse a wrong header", throws(() => S.parseLabels("id\tintent\tok\naaaaaaaaaaaa\tx\tyes\n")));
t("labels refuse a missing header", throws(() => S.parseLabels("aaaaaaaaaaaa\tx\tyes\n")));
t("labels refuse answerable maybe/Yes/empty", ["maybe", "Yes", "", "true"].every((v) => throws(() => S.parseLabels(H + "aaaaaaaaaaaa\tx\t" + v + "\n"))));
t("labels refuse a bad ask_id and an empty correct_intent", throws(() => S.parseLabels(H + "zz\tx\tyes\n")) && throws(() => S.parseLabels(H + "aaaaaaaaaaaa\t\tyes\n")));
t("labels refuse a wrong column count", throws(() => S.parseLabels(H + "aaaaaaaaaaaa\tx\n")) && throws(() => S.parseLabels(H + "aaaaaaaaaaaa\tx\tyes\textra\n")));
t("labels accept CRLF", S.parseLabels(H.replace("\n", "\r\n") + "aaaaaaaaaaaa\tx\tyes\r\n").length === 1);

// (8) CLI
const cli = (...a) => spawnSync("node", ["--experimental-strip-types", "--no-warnings", root + "scripts/score_asks.mjs", ...a], { encoding: "utf8" });
const c1 = cli(FX + "asks_SYNTHETIC_220.jsonl", FX + "labels_SYNTHETIC_220.tsv");
t("CLI on the fixture: exit 0 and prints verdict", c1.status === 0 && /VERDICT: PASS/.test(c1.stdout) && /SYNTHETIC/.test(c1.stdout), c1.stderr);
const shortLabels = path.join(tmp, "short.tsv");
fs.writeFileSync(shortLabels, fs.readFileSync(FX + "labels_SYNTHETIC_220.tsv", "utf8").split("\n").slice(0, 3 + 150).join("\n") + "\n");
const c2 = cli(FX + "asks_SYNTHETIC_220.jsonl", shortLabels);
t("CLI with 150 labels: exit 3, INSUFFICIENT SAMPLE, no VERDICT", c2.status === 3 && /INSUFFICIENT SAMPLE/.test(c2.stdout) && !/VERDICT:/.test(c2.stdout), c2.stdout.slice(-200));
const failLabels = path.join(tmp, "fail.tsv");
fs.writeFileSync(failLabels, fs.readFileSync(FX + "labels_SYNTHETIC_220.tsv", "utf8").replace(/\tyes$/gm, "\tno"));
const c3 = cli(FX + "asks_SYNTHETIC_220.jsonl", failLabels);
t("CLI with all-no labels: exit 1 FAIL", c3.status === 1 && /VERDICT: FAIL/.test(c3.stdout));
const badLog = path.join(tmp, "bad.jsonl");
fs.writeFileSync(badLog, JSON.stringify({ ...rows[0], ip: "1.2.3.4" }) + "\n");
const c4 = cli(badLog, FX + "labels_SYNTHETIC_220.tsv");
t("CLI refuses a log carrying an ip: exit 2", c4.status === 2 && /ERROR/.test(c4.stderr) && c4.stdout === "");
t("CLI usage error: exit 2", cli().status === 2 && cli("only-one").status === 2 && cli(FX + "asks_SYNTHETIC_220.jsonl", failLabels, "extra").status === 2);
t("CLI missing file: exit 2", cli(path.join(tmp, "nope.jsonl"), failLabels).status === 2);
t("CLI does not modify its inputs", fs.readFileSync(FX + "asks_SYNTHETIC_220.jsonl", "utf8") === rows.map((r) => JSON.stringify(r)).join("\n") + "\n");

// (9) fixture is reproducible from the generator, and the lib never touches the network or an IP
const gen = await import(pathToFileURL(root + "scripts/gen_ask_fixture.mjs").href);
const g = gen.build();
t("fixture regenerates byte-identical", g.rows.map((r) => JSON.stringify(r)).join("\n") + "\n" === fs.readFileSync(FX + "asks_SYNTHETIC_220.jsonl", "utf8"));
for (const f of ["lib/concierge/asklog.ts", "lib/concierge/askscore.ts", "scripts/score_asks.mjs"]) {
  const src = fs.readFileSync(root + f, "utf8");
  t(f + ": no network, no ip capture, no clock", !/\bfetch\(|XMLHttpRequest|https?\.request|\bnet\./.test(src) && !/x-forwarded-for|remoteAddress|req\.ip|\bheaders\b/i.test(src) && !/Date\.now\(|new Date\(\)/.test(src));
  t(f + ": no em or en dash", !/[–—]/.test(src));
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`ask_log_scorer: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
