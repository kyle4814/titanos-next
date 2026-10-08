// TIX-999 demo: QR round trip through jsQR -> verifier. Run via `npm test`.
import jsQR from "jsqr";
import { emptyState, createEvent, issueTicket, makeToken, verifyAndRecord, checkResale, setResaleCap, WINDOW_MS } from "../lib/tix.ts";
import { qrRGBA } from "../lib/tixQr.ts";

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };

const st = emptyState();
const ev = createEvent(st, "Demo Fest", 12000, 0);
const tk = issueTicket(st, ev.id, "Sam Fan", 0);
const T0 = 1_800_000_000_000 - (1_800_000_000_000 % WINDOW_MS) + 1000; // early in a window

const token = await makeToken(st.key, tk, T0);
const q = qrRGBA(token, 6, 4);
const hit = jsQR(q.data, q.width, q.height);
ok(hit && hit.data === token, "generated QR decodes back via jsQR to the exact token");

const v1 = await verifyAndRecord(st, hit.data, T0 + 500);
ok(v1.result === "ADMIT", `first scan ADMIT (${v1.result})`);
const v2 = await verifyAndRecord(st, hit.data, T0 + 2000);
ok(v2.result === "DUPLICATE" && v2.firstScanAt === T0 + 500, "second scan DUPLICATE with first-scan time");

const st2 = emptyState(); st2.key = st.key; st2.events = st.events; st2.tickets = st.tickets;
const prev = await verifyAndRecord(st2, token, T0 + WINDOW_MS);
ok(prev.result === "ADMIT", "previous window still accepted (clock skew tolerance)");
const st3 = emptyState(); st3.key = st.key; st3.events = st.events; st3.tickets = st.tickets;
const old = await verifyAndRecord(st3, token, T0 + 2 * WINDOW_MS);
ok(old.result === "EXPIRED", "same token two windows later is EXPIRED");
ok(st3.scans.length === 0, "EXPIRED does not consume the ticket");

const parts = token.split(".");
const tamperedMac = [...parts.slice(0, 4), (parts[4][0] === "0" ? "1" : "0") + parts[4].slice(1)].join(".");
ok((await verifyAndRecord(st3, tamperedMac, T0)).result === "FAKE", "tampered MAC is FAKE");
const tamperedWin = [...parts.slice(0, 3), String(Number(parts[3]) + 1), parts[4]].join(".");
ok((await verifyAndRecord(st3, tamperedWin, T0 + WINDOW_MS)).result === "FAKE", "forged window is FAKE");
const other = emptyState(); other.tickets = st.tickets; other.events = st.events;
ok((await verifyAndRecord(other, token, T0)).result === "FAKE", "code signed with another key is FAKE");
ok((await verifyAndRecord(st3, "https://example.com", T0)).result === "FAKE", "garbage payload is FAKE");
ok((await verifyAndRecord(st3, "TIX1.nope.sam-fan.1.00000000000000000000000000000000", T0)).result === "FAKE", "unknown ticket is FAKE");

const t2 = await makeToken(st.key, tk, T0 + WINDOW_MS);
ok(t2 !== token, "token rotates every window");

ok(checkResale(st, tk.id, 12000, T0).ok && !checkResale(st, tk.id, 12001, T0).ok, "resale at cap allowed, over cap blocked");
setResaleCap(st, ev.id, 5000, T0);
ok(!checkResale(st, tk.id, 6000, T0).ok, "lowered cap applies");
ok(st.audit.some((a) => a.kind === "SCAN_DUPLICATE") && st.audit.some((a) => a.kind === "RESALE_BLOCKED"), "audit log records scans and resale blocks");

console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
