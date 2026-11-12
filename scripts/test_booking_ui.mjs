// Pure-helper tests for the /book page (lib/booking-ui.ts): grouping by the visitor's day, Brisbane time alongside, error copy, the confirmation hash.
// Run: node --experimental-strip-types scripts/test_booking_ui.mjs
import { groupSlots, bookingError, parseConfirmedId, confirmedHref, BRISBANE_TZ } from "../lib/booking-ui.ts";
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail = 1; };
const FRI_1400 = Date.UTC(2026, 10, 13, 4, 0);   // Fri 13 Nov 14:00 Brisbane
const slots = [0, 20, 40].map((m) => ({ start: new Date(FRI_1400 + m * 60000).toISOString(), startMs: FRI_1400 + m * 60000 }));

const bne = groupSlots(slots, BRISBANE_TZ);
ok(bne.length === 1 && bne[0].slots.map((s) => s.local).join(",") === "2:00 pm,2:20 pm,2:40 pm", `Brisbane visitor sees 2:00 pm, 2:20 pm, 2:40 pm (${bne[0]?.slots.map((s) => s.local)})`);
ok(bne[0].slots.every((s) => /^[0-9]{1,2}:[0-9]{2} (am|pm)$/.test(s.brisbane)) && bne[0].slots[0].brisbane === "2:00 pm", "Brisbane time is always carried alongside");
ok(/Fri/.test(bne[0].label) && /13/.test(bne[0].label), `day label is ${bne[0].label}`);

const lon = groupSlots(slots, "Europe/London");   // 04:00 UTC = 04:00 GMT, same calendar day
ok(lon[0].slots[0].local === "4:00 am" && lon[0].slots[0].brisbane === "2:00 pm", "London visitor: 4:00 am local, Brisbane 2:00 pm");
const la = groupSlots(slots, "America/Los_Angeles");   // 04:00 UTC Fri = 8:00 pm Thu in PST
ok(la[0].slots[0].local === "8:00 pm" && /Thu/.test(la[0].label), `Los Angeles visitor sees the slot on THEIR Thursday evening (${la[0].label} ${la[0].slots[0].local})`);
const akl = groupSlots(slots, "Pacific/Auckland");   // +13 in November
ok(akl[0].slots[0].local === "5:00 pm", "Auckland visitor: 5:00 pm");

const two = groupSlots([...slots, { start: new Date(FRI_1400 + 3 * 86400000).toISOString(), startMs: FRI_1400 + 3 * 86400000 }], BRISBANE_TZ);
ok(two.length === 2 && two[0].slots.length === 3, "two days make two groups, in time order even if given out of order");
ok(groupSlots([], BRISBANE_TZ).length === 0, "no slots, no groups");
ok(JSON.stringify(groupSlots([...slots].reverse(), BRISBANE_TZ)) === JSON.stringify(bne), "input order does not matter");

for (const c of ["invalid_name", "invalid_business", "invalid_email", "invalid_phone", "invalid_message", "invalid_slot", "slot_taken", "too_many_attempts"]) ok(bookingError(c).length > 10, `message for ${c}`);
ok(/not made/.test(bookingError("cross_origin")) && /not made/.test(bookingError(undefined)), "an unknown error says the booking was not made");
const all = ["invalid_name", "invalid_business", "invalid_email", "invalid_phone", "invalid_message", "invalid_slot", "slot_taken", "too_many_attempts", "x"].map(bookingError).join(" ");
ok(!/[–—]/.test(all), "no em or en dashes in the error copy");

const id = "bk_" + "ab12".repeat(8);
ok(parseConfirmedId(`#id=${id}`) === id && parseConfirmedId(`id=${id}`) === id, "hash parses");
ok(parseConfirmedId("#id=bk_short") === null && parseConfirmedId("#id=../../x") === null && parseConfirmedId("") === null, "junk hashes are refused");
ok(parseConfirmedId(new URL(confirmedHref(id), "https://x.test").hash) === id, "confirmedHref round-trips");
process.exit(fail);
