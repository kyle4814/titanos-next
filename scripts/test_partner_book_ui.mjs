// Partner seat book of clients UI (f313): view-model behaviour, every state, a real server render of the component, source contract,
// and 10 in-script mutants that must each make the suite FAIL. SYNTHETIC rows only. No network. Run: node scripts/test_partner_book_ui.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const R = (p) => new URL(`../${p}`, import.meta.url);
const read = (p) => fs.readFileSync(R(p), "utf8");
const require = createRequire(R("package.json"));
const ts = require("typescript");
const reactAbs = pathToFileURL(require.resolve("react")).href, jsxAbs = pathToFileURL(require.resolve("react/jsx-runtime")).href, serverAbs = pathToFileURL(require.resolve("react-dom/server")).href;
const { renderToStaticMarkup } = await import(serverAbs);

const SRC = { vm: read("lib/partner-book-ui.ts"), comp: read("components/PartnerBook.tsx"), ent: read("lib/portal-ent.ts"), client: read("app/app/partner/client.tsx") };

async function load(over = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pbui-"));
  const t = (src, name, jsx) => {
    let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    js = js.replace(/from "react\/jsx-runtime"/g, `from "${jsxAbs}"`).replace(/from "react"/g, `from "${reactAbs}"`).replace(/from "@\/lib\/partner-book-ui"/g, 'from "./vm.mjs"').replace(/from "@\/lib\/portal-ent"/g, 'from "./ent_stub.mjs"').replace(/from "@\/lib\/portal"/g, 'from "./portal_stub.mjs"');
    fs.writeFileSync(path.join(dir, name), js);
  };
  fs.writeFileSync(path.join(dir, "portal_stub.mjs"), "export const browserApi = () => ({});");
  fs.writeFileSync(path.join(dir, "ent_stub.mjs"), "export const book = async () => ({});");
  t(over.vm ?? SRC.vm, "vm.mjs"); t(over.comp ?? SRC.comp, "comp.mjs");
  const vm = await import(pathToFileURL(path.join(dir, "vm.mjs")).href + "?" + Math.random());
  const comp = await import(pathToFileURL(path.join(dir, "comp.mjs")).href + "?" + Math.random());
  return { vm, comp };
}

async function suite(over, label) {
  let fail = 0;
  const ok = (c, m) => { if (!c) { fail++; if (label === "real") console.log(`FAIL ${m}`); } else if (label === "real") console.log(`PASS ${m}`); };
  const { vm, comp } = await load(over);
  const compSrc = over.comp ?? SRC.comp, vmSrc = over.vm ?? SRC.vm;
  const html = (state, extra = {}) => renderToStaticMarkup(comp.PartnerBookView({ state, ...extra }));
  const P = vm.SAMPLE_PAGE;
  // --- view model
  const v = vm.buildBookView(P);
  ok(v.ok && v.rows.length === 4 && !v.empty, "sample page builds 4 rows");
  ok(v.ok && v.rows.reduce((n, r) => n + r.shareCents, 0) + v.totals.unsourcedCents === v.totals.accruedCents && v.reconciled, "row shares sum to the ledger total to the cent");
  ok(v.ok && v.totals.accrued === "AU$950.22" && v.rows[0].share === "AU$450.01" && v.rows[3].share === "AU$0.11", "money is formatted to the cent");
  ok(vm.audCents(0) === "AU$0.00" && vm.audCents(123456789) === "AU$1,234,567.89" && vm.audCents(-250) === "-AU$2.50", "audCents edge cases");
  const off = vm.buildBookView({ ...P, totals: { ...P.totals, accruedCents: P.totals.accruedCents + 1 } });
  ok(off.ok && off.reconciled === false, "a total one cent out is flagged, never silently shown as fine");
  const part = vm.buildBookView({ ...P, nextCursor: "v1.abc.def", rows: P.rows.slice(0, 2) });
  ok(part.ok && part.reconciled === true && part.more && part.nextCursor === "v1.abc.def", "a partial page is not falsely flagged");
  const cons = v.ok ? v.rows : [];
  ok(cons[1].withheld && cons[1].domain === vm.WITHHELD_TEXT && cons[1].proof === vm.WITHHELD_TEXT, "an unconsented client shows no domain and no proof");
  ok(cons[3].unattributed && cons[3].client === "Unattributed" && cons[3].domain === "unattributed" && cons[3].plan === "Not known yet" && cons[3].proof === "No re-scan proof yet", "an unattributed referral shows 'unattributed', never a guess");
  ok(cons[2].unattributed === false && cons[2].domain === "bakery.example.invalid" && cons[2].proof === "scan_example_3", "an attributed referral shows its identity");
  ok(v.ok && v.rows.map((r) => r.statusCode).join() === "active,pending,active,active" && v.rows[1].status === "Pending first payment", "status text");
  const e = vm.buildBookView({ ...P, rows: [] });
  ok(e.ok && e.empty && /No clients/.test(e.emptyText) && e.rows.length === 0, "empty book gives a plain empty state");
  const E = (r, code) => ok(r.ok === false && r.code === code && r.message.length > 10 && !/NaN|undefined|null/.test(r.message), `typed error ${code}`);
  E(vm.buildBookView(null), "NOT_A_PAGE"); E(vm.buildBookView([]), "NOT_A_PAGE"); E(vm.buildBookView({ totals: P.totals }), "NOT_A_PAGE");
  E(vm.buildBookView({ rows: [] }), "BAD_TOTALS"); E(vm.buildBookView({ rows: [], totals: { ...P.totals, accruedCents: 1.5 } }), "BAD_TOTALS");
  E(vm.buildBookView({ ...P, rows: [null] }), "BAD_ROW"); E(vm.buildBookView({ ...P, rows: [{ ...P.rows[0], shareCents: "450" }] }), "BAD_ROW");
  E(vm.buildBookView({ ...P, rows: [{ ...P.rows[0], status: "weird" }] }), "BAD_ROW"); E(vm.buildBookView({ ...P, rows: [{ ...P.rows[0], plan: 5 }] }), "BAD_ROW");
  // --- states: loading / empty / 503 / 403 / failed are all different, and an error is never the empty state
  const s503 = vm.bookStateFromError({ status: 503 }), s403 = vm.bookStateFromError({ status: 403 }), s0 = vm.bookStateFromError(new Error("x"));
  ok(s503.kind === "error" && s503.code === "unavailable" && s403.code === "forbidden" && s0.code === "failed", "503, 403 and other failures map to distinct error states");
  const hLoad = html({ kind: "loading" }), h503 = html(s503), h403 = html(s403), hEmpty = html(vm.bookStateFromPage({ ...P, rows: [] , totals: { ...P.totals, clients: 0, accruedCents: 0, heldCents: 0 } }));
  ok(/aria-busy="true"/.test(hLoad) && hLoad.includes(vm.LOADING_TEXT), "loading state renders");
  ok(h503.includes('role="alert"') && h503.includes(vm.UNAVAILABLE_TEXT) && !h503.includes(vm.EMPTY_TEXT) && !h503.includes("<table"), "503 renders the unavailable message, not an empty book");
  ok(h403.includes(vm.FORBIDDEN_TEXT) && !h403.includes(vm.EMPTY_TEXT) && !h403.includes("<table"), "403 renders the forbidden message, not an empty book");
  ok(hEmpty.includes(vm.EMPTY_TEXT) && !hEmpty.includes("<table") && !hEmpty.includes('role="alert"'), "empty state renders the empty text only");
  const hBadPage = html(vm.bookStateFromPage({ rows: "nope" }));
  ok(hBadPage.includes('role="alert"') && !hBadPage.includes("<table"), "an unreadable page renders an error, no table");
  // --- real render
  const h = html(vm.bookStateFromPage(P), { synthetic: true });
  ok(h.includes(vm.SYNTHETIC_LABEL), "synthetic example is labelled");
  ok((h.match(/<tr/g) ?? []).length === 5, "one header row plus exactly one row per client (no extra rows)");
  for (const s of ["Example Plumbing Pty Ltd", "plumbing.example.invalid", "ai_growth", "Active", "AU$450.01", "scan_example_1", "Pending first payment", "Share accrued: AU$950.22", "Clients: 4", "Held: AU$300.03"]) ok(h.includes(s), `render shows ${s}`);
  ok(h.includes(vm.WITHHELD_TEXT) && h.includes('data-unattributed="1"') && h.includes(">Unattributed<"), "render shows withheld and unattributed rows");
  ok(!h.includes("Not tied to a client"), "no unsourced line when there are no unsourced cents");
  const hOff = html(vm.bookStateFromPage({ ...P, totals: { ...P.totals, accruedCents: P.totals.accruedCents + 1 } }));
  ok(hOff.includes('role="alert"') && /do not add up/.test(hOff), "a mismatched total shows a visible warning");
  const hUns = html(vm.bookStateFromPage({ ...P, totals: { ...P.totals, accruedCents: P.totals.accruedCents + 250, unsourcedCents: 250 } }));
  ok(hUns.includes("Not tied to a client: AU$2.50") && !/do not add up/.test(hUns), "unsourced cents are shown, not hidden");
  const hMore = html(vm.bookStateFromPage({ ...P, nextCursor: "v1.x.y" }), { onMore: () => {} });
  ok(hMore.includes("Next page"), "next page button when more rows exist");
  // --- copy rules and source contract
  ok(!/[–—]/.test(h + hLoad + h503 + h403 + hEmpty + vmSrc + compSrc), "zero em or en dashes in copy and source");
  ok(!/delve|leverage|robust|holistic|seamless|cutting-edge/i.test(h + vmSrc), "no AI-tell words");
  ok(!/fetch\(|XMLHttpRequest|sendBeacon|mailto:|WebSocket/i.test(vmSrc), "view-model has no network or send path");
  ok(/ent\.book\(browserApi\(\), partnerId/.test(compSrc) && /bookStateFromError\(e\)/.test(compSrc) && /bookStateFromPage\(page\)/.test(compSrc), "container fetches the book for its partner and routes errors through bookStateFromError");
  ok(/export const book = \(api: Api, pid: string, cursor\?: string\) => call\(api, "GET", `\/partner\/book\?partnerId=\$\{encodeURIComponent\(pid\)\}/.test(SRC.ent), "portal-ent.book calls GET /partner/book with the partner id");
  ok(/<PartnerBook partnerId=\{partner\.id\} \/>/.test(SRC.client), "the partner seat page renders the book");
  return fail;
}

const base = await suite({}, "real");
const MUT = [
  ["totals off by a cent (reconcile ignores unsourced)", "vm", "rowSum + totals.unsourcedCents === totals.accruedCents", "rowSum === totals.accruedCents + 1"],
  ["reconcile always true", "vm", "const reconciled = more ? true : rowSum + totals.unsourcedCents === totals.accruedCents;", "const reconciled = true;"],
  ["503 swallowed to empty", "vm", 'if (status === 503) return { kind: "error", code: "unavailable", text: UNAVAILABLE_TEXT };', 'if (status === 503) return { kind: "ready", view: buildBookView({ rows: [], totals: { clients: 0, accruedCents: 0, heldCents: 0, unsourcedCents: 0, paidOutCents: 0 } }) };'],
  ["403 shown as failed", "vm", 'if (status === 403 || status === 401) return { kind: "error", code: "forbidden", text: FORBIDDEN_TEXT };', ""],
  ["unconsented client domain shown", "vm", "withheld ? WITHHELD_TEXT : text(r.domain", "text(r.domain"],
  ["unattributed referral shows its guessed domain", "vm", "domain: unattributed ? UNATTRIBUTED_TEXT.toLowerCase() : withheld", "domain: withheld"],
  ["proof taken from the domain field", "vm", ": text(r.lastRescanProofId, \"No re-scan proof yet\")", ": text(r.domain, \"No re-scan proof yet\")"],
  ["cents dropped from money", "vm", 'const neg = c < 0, a = Math.abs(c), d = Math.floor(a / 100), cents = String(a % 100).padStart(2, "0");', 'const neg = c < 0, a = Math.abs(c), d = Math.floor(a / 100), cents = "00";'],
  ["row sum counts only the first row", "vm", "const rowSum = rows.reduce((n, r) => n + r.shareCents, 0);", "const rowSum = rows.length ? rows[0].shareCents : 0;"],
  ["component swallows a fetch error into the empty page", "comp", ".catch((e) => { if (live) setState(bookStateFromError(e)); })", ".catch(() => { if (live) setState(bookStateFromPage({ rows: [], totals: { clients: 0, accruedCents: 0, heldCents: 0, unsourcedCents: 0, paidOutCents: 0 } })); })"],
  ["error state rendered with the empty text", "comp", "<p role=\"alert\" data-code={state.code} style={{ margin: 0 }}>{state.text}</p>", "<p style={{ margin: 0 }}>{EMPTY_TEXT}</p>"],
  ["unsourced cents hidden", "comp", "{v.totals.unsourcedCents !== 0 && <li>Not tied to a client: {v.totals.unsourced}</li>}", ""],
  ["extra phantom row rendered", "comp", "{v.rows.map((r) => (", "{[...v.rows, ...v.rows.slice(0, 1)].map((r, i) => ("],
];
let killed = 0; const survived = [];
for (const [name, which, from, to] of MUT) {
  const src = SRC[which];
  if (!src.includes(from)) { survived.push(`${name} (pattern not found)`); continue; }
  let mutFail = 1;
  try { mutFail = await suite({ [which]: src.replace(from, to) }, "mut"); } catch { mutFail = 1; /* a mutant that cannot even load is dead */ }
  if (mutFail > 0) killed++; else survived.push(name);
}
console.log(`partner book UI: base failures ${base}, mutants ${killed} killed of ${MUT.length}${survived.length ? `, SURVIVED: ${survived.join("; ")}` : ""}`);
if (base || survived.length) process.exit(1);
console.log("PARTNERBOOKUI OK");
