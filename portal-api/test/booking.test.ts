// Own booking system (2026-11-12): slot generation, POST /api/book, GET /api/slots, the .ics, the Telegram alert (mocked).
// SYNTHETIC data only. The store is the real D1BookingStore over FakeD1 (real SQLite, the real migrations).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { handle } from "../src/index.ts";
import { make } from "./harness.ts";
import { FakeD1 } from "./fake_d1.ts";
import { D1BookingStore } from "../src/booking/store.ts";
import { BOOKING, type BookingConfig } from "../src/booking/config.ts";
import { generateSlots, freeSlots, formatLocal } from "../src/booking/slots.ts";
import { telegramNotifier } from "../src/booking/telegram.ts";
import { Throttle } from "../src/throttle.ts";
import type { Deps } from "../src/service.ts";

const ORIGIN = "https://titanos.tech";
const MIN = 60_000, DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 12, 0, 0);          // Thu 12 Nov 2026 10:00 Brisbane
const FRI_1400 = Date.UTC(2026, 10, 13, 4, 0);      // Fri 13 Nov 14:00 Brisbane = 04:00 UTC
const bris = (ms: number) => new Date(ms + 600 * MIN);

function setup(opts: { notify?: (t: string) => Promise<void>; throttle?: boolean; noBooking?: boolean; config?: BookingConfig } = {}) {
  const h = make();
  const db = new FakeD1();
  const store = new D1BookingStore(db);
  const sent: string[] = [];
  const logs: string[] = [];
  const notify = opts.notify ?? (async (t: string) => { sent.push(t); });
  const throttle = opts.throttle ? new Throttle({ maxFailures: 5, windowMs: 15 * 60_000, lockoutMs: 15 * 60_000, now: () => NOW }) : undefined;
  const deps: Deps = { ...h.deps, now: () => NOW, throttle, booking: opts.noBooking ? undefined : { store, notify, config: opts.config, log: (l) => logs.push(l) } };
  const call = (method: string, path: string, body?: unknown, headers: Record<string, string | null> = {}) => {
    const hs: Record<string, string | null> = { ...(body === undefined ? {} : { "content-type": "application/json" }), origin: ORIGIN, "cf-connecting-ip": "203.0.113.7", ...headers };
    for (const k of Object.keys(hs)) if (hs[k] === null) delete hs[k];
    return handle(new Request("https://api.test" + path, { method, headers: hs as Record<string, string>, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) }), { TITANOS_SITE_ORIGIN: ORIGIN } as never, deps);
  };
  return { db, store, sent, logs, call };
}
const good = (over: Record<string, unknown> = {}) => ({ slot: new Date(FRI_1400).toISOString(), name: "Sam Tradie", business: "Sam's Plumbing", email: "sam@example.com", phone: "0400 000 000", eatsWeek: "Quotes and invoices take me every Sunday night.", ...over });
const rows = (db: FakeD1) => db.db.prepare("SELECT * FROM bookings").all() as any[];

// ---------- slot generation ----------
test("slots: defaults give 6 per weekday, 20 min apart, 14:00 to 15:40 Brisbane, Monday to Friday only", () => {
  const s = generateSlots(NOW);
  assert.equal(s.length, 60);                          // 10 weekdays (13 Nov to 26 Nov) x 6
  assert.equal(s[0], FRI_1400);
  for (const t of s) {
    const b = bris(t);
    assert.ok(b.getUTCDay() >= 1 && b.getUTCDay() <= 5, "weekday");
    const m = b.getUTCHours() * 60 + b.getUTCMinutes();
    assert.ok(m >= 840 && m <= 940 && m % 20 === 0, "inside 14:00 to 16:00 on the 20 minute grid, last start 15:40");
  }
  assert.deepEqual(s.slice(0, 6).map((t) => (t - FRI_1400) / MIN), [0, 20, 40, 60, 80, 100]);
});
test("slots: weekends never appear and the window is day 1 to day 14", () => {
  const s = generateSlots(NOW);
  assert.ok(!s.some((t) => [0, 6].includes(bris(t).getUTCDay())));
  assert.ok(s.every((t) => t < Date.UTC(2026, 10, 27, 0, 0)));   // nothing past Thu 26 Nov
  const fromFriday = generateSlots(Date.UTC(2026, 10, 13, 0, 0)); // Fri 10:00 Brisbane: Sat and Sun skipped, Mon first
  assert.equal(bris(fromFriday[0]).getUTCDay(), 1);
  const fromSunday = generateSlots(Date.UTC(2026, 10, 15, 0, 0));
  assert.equal(bris(fromSunday[0]).getUTCDay(), 1);
});
test("slots: today is never offered and every slot is in the future", () => {
  const wedNoon = Date.UTC(2026, 10, 11, 2, 0);   // Wed 12:00 Brisbane, before the 14:00 slots
  const s = generateSlots(wedNoon);
  assert.ok(s.every((t) => t > wedNoon));
  assert.equal(bris(s[0]).getUTCDate(), 12);      // Thursday the 12th, not Wednesday afternoon
});
test("slots: the day rolls over on Brisbane's midnight, not UTC's", () => {
  const thu2330 = Date.UTC(2026, 10, 12, 13, 30);   // Thu 23:30 Brisbane (still the 12th)
  const fri0030 = Date.UTC(2026, 10, 12, 14, 30);   // Fri 00:30 Brisbane (now the 13th)
  assert.equal(bris(generateSlots(thu2330)[0]).getUTCDate(), 13);
  assert.equal(bris(generateSlots(fri0030)[0]).getUTCDate(), 16);   // tomorrow is Saturday, so Monday
});
test("slots: a taken slot is not free, and nothing else moves", () => {
  const all = generateSlots(NOW);
  const free = freeSlots(NOW, [FRI_1400]);
  assert.equal(free.length, all.length - 1);
  assert.ok(!free.includes(FRI_1400));
});
test("slots: one config file drives the rules (change the hours and the grid follows)", () => {
  const cfg: BookingConfig = { ...BOOKING, startMin: 9 * 60, endMin: 10 * 60, slotMin: 30, weekdays: [2], maxDaysAhead: 7 };
  const s = generateSlots(NOW, cfg);
  assert.equal(s.length, 2);                       // one Tuesday (17 Nov), 09:00 and 09:30
  assert.equal(formatLocal(s[0], cfg), "Tue 17 Nov, 9:00 am AEST (Brisbane)");
});
test("slots: Brisbane label", () => { assert.equal(formatLocal(FRI_1400), "Fri 13 Nov, 2:00 pm AEST (Brisbane)"); });

// ---------- GET /api/slots ----------
test("GET /api/slots lists free slots and drops a booked one", async () => {
  const t = setup();
  let r = await (await t.call("GET", "/api/slots")).json() as any;
  assert.equal(r.slots.length, 60); assert.equal(r.tz, "Australia/Brisbane"); assert.equal(r.slotMinutes, 20);
  assert.equal(r.slots[0].start, new Date(FRI_1400).toISOString());
  assert.equal((await t.call("POST", "/api/book", good())).status, 201);
  r = await (await t.call("GET", "/api/slots")).json() as any;
  assert.equal(r.slots.length, 59); assert.ok(!r.slots.some((s: any) => s.startMs === FRI_1400));
});
test("GET /api/slots is GET only", async () => { assert.equal((await setup().call("POST", "/api/slots", {})).status, 405); });

// ---------- POST /api/book ----------
test("POST /api/book stores the booking and sends ONE Telegram alert with name, business, Brisbane time, what eats the week", async () => {
  const t = setup();
  const res = await t.call("POST", "/api/book", good());
  assert.equal(res.status, 201);
  const body = await res.json() as any;
  assert.match(body.id, /^bk_[0-9a-f]{32}$/); assert.equal(body.startMs, FRI_1400); assert.equal(body.endMs, FRI_1400 + 20 * MIN);
  const r = rows(t.db); assert.equal(r.length, 1);
  assert.equal(r[0].email, "sam@example.com"); assert.equal(r[0].slot_start, FRI_1400); assert.equal(r[0].status, "confirmed"); assert.equal(r[0].notified_at, NOW);
  assert.equal(t.sent.length, 1);
  for (const s of ["Sam Tradie", "Sam's Plumbing", "Fri 13 Nov, 2:00 pm AEST (Brisbane)", "Quotes and invoices take me every Sunday night."]) assert.ok(t.sent[0].includes(s), s);
});
test("a double booking is refused: second POST for the same slot is 409 and sends no second alert", async () => {
  const t = setup();
  assert.equal((await t.call("POST", "/api/book", good())).status, 201);
  const second = await t.call("POST", "/api/book", good({ email: "other@example.com" }));
  assert.equal(second.status, 409); assert.deepEqual(await second.json(), { error: "slot_taken" });
  assert.equal(rows(t.db).length, 1); assert.equal(t.sent.length, 1);
});
test("racing double booking: exactly one of two simultaneous POSTs wins", async () => {
  for (let i = 0; i < 20; i++) {
    const t = setup();
    const out = await Promise.all([t.call("POST", "/api/book", good()), t.call("POST", "/api/book", good({ email: "b@example.com" })), t.call("POST", "/api/book", good({ email: "c@example.com" }))]);
    assert.deepEqual(out.map((r) => r.status).sort(), [201, 409, 409]);
    assert.equal(rows(t.db).length, 1); assert.equal(t.sent.length, 1);
  }
});
test("the unique index, not the application, is what refuses a double booking (store level)", async () => {
  const t = setup();
  const row = { id: "bk_" + "a".repeat(32), slotStart: FRI_1400, slotEnd: FRI_1400 + 20 * MIN, name: "A", business: "B", email: "a@example.com", phone: null, eatsWeek: "x", status: "confirmed" as const, createdAt: NOW, notifiedAt: null };
  assert.equal(await t.store.insert(row), true);
  assert.equal(await t.store.insert({ ...row, id: "bk_" + "b".repeat(32) }), false);
  t.db.db.exec("UPDATE bookings SET status = 'cancelled'");
  assert.equal(await t.store.insert({ ...row, id: "bk_" + "c".repeat(32) }), true, "a cancelled booking frees the slot");
});
test("validation: each bad field gets its own 400 and nothing is stored", async () => {
  const t = setup();
  const cases: [Record<string, unknown>, string][] = [
    [{ name: "" }, "invalid_name"], [{ name: "x".repeat(101) }, "invalid_name"], [{ name: 5 }, "invalid_name"],
    [{ business: " " }, "invalid_business"], [{ email: "nope" }, "invalid_email"], [{ email: undefined }, "invalid_email"],
    [{ phone: "abc" }, "invalid_phone"], [{ phone: "12" }, "invalid_phone"],
    [{ eatsWeek: "" }, "invalid_message"], [{ eatsWeek: "y".repeat(1001) }, "invalid_message"],
    [{ slot: "garbage" }, "invalid_slot"], [{ slot: undefined }, "invalid_slot"],
    [{ slot: new Date(FRI_1400 + 5 * MIN).toISOString() }, "invalid_slot"],          // off the 20 minute grid
    [{ slot: new Date(Date.UTC(2026, 10, 14, 4, 0)).toISOString() }, "invalid_slot"], // Saturday
    [{ slot: new Date(Date.UTC(2026, 10, 12, 4, 0)).toISOString() }, "invalid_slot"], // today
    [{ slot: new Date(NOW - DAY).toISOString() }, "invalid_slot"],                    // the past
    [{ slot: new Date(Date.UTC(2026, 11, 7, 4, 0)).toISOString() }, "invalid_slot"],  // beyond 14 days
  ];
  for (const [over, code] of cases) {
    const r = await t.call("POST", "/api/book", good(over));
    assert.equal(r.status, 400, JSON.stringify(over)); assert.equal(((await r.json()) as any).error, code, JSON.stringify(over));
  }
  assert.equal(rows(t.db).length, 0); assert.equal(t.sent.length, 0);
});
test("phone is optional", async () => {
  const t = setup();
  const b = good(); delete (b as any).phone;
  assert.equal((await t.call("POST", "/api/book", b)).status, 201);
  assert.equal(rows(t.db)[0].phone, null); assert.match(t.sent[0], /Phone: not given/);
});
test("honeypot: a filled hidden field looks like success but stores nothing and alerts nobody", async () => {
  const t = setup();
  const r = await t.call("POST", "/api/book", good({ website: "http://spam.example" }));
  assert.equal(r.status, 201); assert.deepEqual(await r.json(), { ok: true });
  assert.equal(rows(t.db).length, 0); assert.equal(t.sent.length, 0);
  assert.equal((await t.call("POST", "/api/book", good({ website: "" }))).status, 201, "an empty honeypot is a real visitor");
  assert.equal(rows(t.db).length, 1);
});
test("rate limit: the 6th attempt from one IP in the window is 429 with Retry-After; another IP is unaffected", async () => {
  const t = setup({ throttle: true });
  for (let i = 0; i < 5; i++) assert.equal((await t.call("POST", "/api/book", good({ slot: "bad" }))).status, 400, "invalid attempts count too");
  const blocked = await t.call("POST", "/api/book", good());
  assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  assert.equal(rows(t.db).length, 0);
  assert.equal((await t.call("POST", "/api/book", good(), { "cf-connecting-ip": "198.51.100.9" })).status, 201);
});
test("cross-origin guard: a foreign Origin or a cross-site fetch is 403 and stores nothing", async () => {
  const t = setup();
  for (const origin of ["https://evil.example", "https://titanos.tech.evil.example", "null", "http://titanos.tech", "https://www.titanos.tech"]) {
    const r = await t.call("POST", "/api/book", good(), { origin });
    assert.equal(r.status, 403, origin); assert.equal(((await r.json()) as any).error, "cross_origin");
  }
  assert.equal(rows(t.db).length, 0); assert.equal(t.sent.length, 0);
});
test("cross-origin guard: Sec-Fetch-Site cross-site with no Origin is refused; same-origin and bare server calls pass", async () => {
  const t = setup();
  assert.equal((await t.call("POST", "/api/book", good(), { origin: null, "sec-fetch-site": "cross-site" })).status, 403);
  assert.equal(rows(t.db).length, 0);
  assert.equal((await t.call("POST", "/api/book", good(), { origin: null, "sec-fetch-site": "same-origin" })).status, 201);
  assert.equal((await t.call("POST", "/api/book", good({ slot: new Date(FRI_1400 + 20 * MIN).toISOString() }), { origin: null })).status, 201);
  assert.equal(rows(t.db).length, 2);
});
test("body must be JSON: another content type is 415, oversize is 413, junk is 400", async () => {
  const t = setup();
  assert.equal((await t.call("POST", "/api/book", "a=b", { "content-type": "application/x-www-form-urlencoded" })).status, 415);
  assert.equal((await t.call("POST", "/api/book", "{nope")).status, 400);
  assert.equal((await t.call("POST", "/api/book", "[1]")).status, 400);
  assert.equal((await t.call("POST", "/api/book", JSON.stringify(good({ eatsWeek: "z".repeat(20_000) })))).status, 413);
  assert.equal((await t.call("GET", "/api/book")).status, 405);
});
test("no booking store bound: every booking route answers 503 booking_unavailable", async () => {
  const t = setup({ noBooking: true });
  assert.equal((await t.call("GET", "/api/slots")).status, 503);
  assert.equal((await t.call("POST", "/api/book", good())).status, 503);
});

// ---------- Telegram (mocked) ----------
test("a Telegram failure never loses the booking: 201, row kept, notified_at stays null, token not logged", async () => {
  const t = setup({ notify: async () => { throw new Error("telegram_http_500"); } });
  const r = await t.call("POST", "/api/book", good());
  assert.equal(r.status, 201); assert.equal(rows(t.db).length, 1); assert.equal(rows(t.db)[0].notified_at, null);
  assert.ok(t.logs.some((l) => l.includes("booking alert failed")));
});
test("telegramNotifier: one sendMessage call to api.telegram.org, chat id and text in the JSON, nothing else", async () => {
  const calls: { url: string; init: any }[] = [];
  const f = (async (url: string, init: any) => { calls.push({ url, init }); return new Response('{"ok":true}', { status: 200 }); }) as unknown as typeof fetch;
  const n = telegramNotifier({ TELEGRAM_BOT_TOKEN: "123:TESTTOKEN", TELEGRAM_CHAT_ID: "42" }, f)!;
  await n("hello");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.telegram.org/bot123:TESTTOKEN/sendMessage");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init.body), { chat_id: "42", text: "hello", disable_web_page_preview: true });
});
test("telegramNotifier: missing secrets mean no notifier; errors never carry the token", async () => {
  assert.equal(telegramNotifier({}), undefined);
  assert.equal(telegramNotifier({ TELEGRAM_BOT_TOKEN: "x" }), undefined);
  const boom = (async () => { throw new Error("connect https://api.telegram.org/bot123:TESTTOKEN/sendMessage failed"); }) as unknown as typeof fetch;
  await assert.rejects(telegramNotifier({ TELEGRAM_BOT_TOKEN: "123:TESTTOKEN", TELEGRAM_CHAT_ID: "42" }, boom)!("x"), (e: Error) => !e.message.includes("TESTTOKEN"));
  const bad = (async () => new Response("no", { status: 401 })) as unknown as typeof fetch;
  await assert.rejects(telegramNotifier({ TELEGRAM_BOT_TOKEN: "123:TESTTOKEN", TELEGRAM_CHAT_ID: "42" }, bad)!("x"), (e: Error) => e.message === "telegram_http_401");
});
test("the worker source never calls getUpdates or deleteWebhook", () => {
  const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
  const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith(".ts") ? [join(d, e.name)] : []);
  for (const f of walk(SRC)) { const s = readFileSync(f, "utf8"); assert.ok(!/getUpdates|deleteWebhook|setWebhook/.test(s), f); }
});

// ---------- confirmation + .ics ----------
test("GET /api/book/:id returns the booking and /ics returns a valid calendar file", async () => {
  const t = setup();
  const { id } = await (await t.call("POST", "/api/book", good())).json() as any;
  const info = await (await t.call("GET", `/api/book/${id}`)).json() as any;
  assert.equal(info.name, "Sam Tradie"); assert.equal(info.startMs, FRI_1400); assert.equal("email" in info, false, "email is not echoed back");
  const ics = await t.call("GET", `/api/book/${id}/ics`);
  assert.equal(ics.status, 200); assert.match(ics.headers.get("content-type")!, /^text\/calendar/); assert.match(ics.headers.get("content-disposition")!, /attachment/);
  const body = await ics.text();
  for (const s of ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "DTSTART:20261113T040000Z", "DTEND:20261113T042000Z", `UID:${id}@titanos.tech`, "END:VEVENT", "END:VCALENDAR"]) assert.ok(body.includes(s), s);
  assert.ok(body.split("\r\n").every((l) => l.length <= 75), "folded to 75");
  assert.ok(!body.includes("sam@example.com") && !body.includes("Sam's Plumbing"), "no booker details in the file");
  assert.equal((await t.call("GET", "/api/book/bk_" + "0".repeat(32))).status, 404);
  assert.equal((await t.call("GET", "/api/book/nope")).status, 404);
});
