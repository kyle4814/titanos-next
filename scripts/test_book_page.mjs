// /book (2026-11-12): source and built-output checks for the booking page, the confirmation page and the primary-CTA change.
// Usage: node scripts/test_book_page.mjs [outDir=out]    (needs a built export)
import fs from "node:fs";

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail = 1; };
const out = process.argv[2] || "out";
const rd = (f) => fs.readFileSync(f, "utf8");
const txt = (h) => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

// ---- built output
const book = rd(`${out}/book.html`);
for (const [id, name] of [["bk-name", "name"], ["bk-business", "business"], ["bk-email", "email"], ["bk-phone", "phone"], ["bk-eats", "eatsWeek"]]) {
  ok(new RegExp(`<label[^>]*for="${id}"`).test(book) && new RegExp(`id="${id}"[^>]*name="${name}"|name="${name}"[^>]*id="${id}"`).test(book), `field ${name} has a label and a name`);
}
ok(/name="website"[^>]*tabindex="-1"|tabindex="-1"[^>]*name="website"/.test(book), "honeypot field present and out of the tab order");
ok(/Book my call/.test(book), "submit button present");
ok(/<link rel="canonical" href="https:\/\/titanos\.tech\/book"/.test(book), "canonical /book");
ok(!/[–—]/.test(txt(book)), "no em or en dashes on /book");
const conf = rd(`${out}/book/confirmed.html`);
ok(/noindex/.test(conf), "/book/confirmed is noindex");
ok(!/[–—]/.test(txt(conf)), "no em or en dashes on /book/confirmed");

// ---- the API host the page calls must be in the CSP connect-src
const cfg = rd("lib/config.ts");
const apiBase = /API_BASE:\s*"(https:\/\/[^"]+)"/.exec(cfg.slice(cfg.indexOf("export const PORTAL")))?.[1];
const layout = rd("app/layout.tsx");
ok(!!apiBase && new RegExp(`connect-src[^;\\n]*${apiBase.replace(/[.]/g, "\\.")}`).test(layout), `CSP connect-src allows ${apiBase}`);
ok(/BookingForm/.test(rd("app/book/page.tsx")) && /PORTAL\.API_BASE\}\/api\/slots/.test(rd("components/book/BookingForm.tsx")) && /PORTAL\.API_BASE\}\/api\/book/.test(rd("components/book/BookingForm.tsx")), "the page calls /api/slots and /api/book on the portal API");

// ---- tap targets: every control on the new pages is at least 44 px (source level; the rendered sweeps cover the rest)
const form = rd("components/book/BookingForm.tsx") + rd("components/book/Confirmed.tsx");
const mins = [...form.matchAll(/minHeight:\s*(\d+)/g)].map((m) => +m[1]);
ok(mins.length >= 4 && mins.every((n) => n >= 44), `every declared minHeight is 44 or more (${mins.join(",")})`);
ok(/fontSize:\s*16\b/.test(form), "inputs use 16 px text so phones do not zoom on focus");
ok(!/transition|animation|@keyframes/.test(form), "the booking components add no motion of their own (reduced-motion safe)");

// ---- primary CTA is Book a call, Telegram stays secondary
const cb = rd("components/ContactButtons.tsx");
const iBook = cb.indexOf("href={BOOK_HREF}"), iTg = cb.indexOf("href={CONTACT.TELEGRAM_URL}");
ok(iBook > 0 && iTg > iBook, "ContactButtons: Book a call comes first");
ok(/href=\{BOOK_HREF\} variant="primary"/.test(cb) && /variant="secondary"/.test(cb.slice(iTg, iTg + 200)), "ContactButtons: Book a call is primary, Telegram is secondary");
ok(/href=\{BOOK_HREF\}/.test(rd("components/Nav.tsx")) && !/AUDIT_MESSAGE_HREF/.test(rd("components/Nav.tsx")), "Nav primary CTA goes to /book");
ok(/href=\{BOOK_HREF\}/.test(rd("components/StickyMobileCta.tsx")), "sticky mobile CTA goes to /book");
const home = rd(`${out}/index.html`);
ok(/href="\/book"/.test(home) && /Book a free call with Kyle/.test(txt(home)), "homepage carries the Book a call CTA");
ok(!/Message Kyle for a free consultation and report/.test(txt(home)), "homepage no longer leads with Message Kyle");
const pages = JSON.parse(rd("scripts/export_pages.json")).pages;
ok(pages.includes("book.html") && pages.includes("book/confirmed.html"), "export manifest lists /book and /book/confirmed");
process.exit(fail);
