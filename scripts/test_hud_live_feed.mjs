// Live receipt feed gate: shape validation, fallback on failure, public file shipped, nothing identifying in the feed.
import { readFileSync, existsSync } from "node:fs";
import { validateFeed } from "../lib/hud/validate.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const root = new URL("../", import.meta.url);
const R = (p) => readFileSync(new URL(p, root), "utf8");
const good = JSON.parse(R("lib/hud/feed.json"));
const it = { t: 1, acct: "A", cat: "SITE", code: "SITE-1" };
const mk = (o) => ({ generated: 5, items: [{ ...it, ...o }] });

ok(validateFeed(good)?.items.length === good.items.length, "the shipped feed passes validation");
ok(validateFeed(null) === null && validateFeed("x") === null && validateFeed({}) === null, "non-objects and missing items are rejected");
ok(validateFeed({ generated: 5, items: "no" }) === null, "items must be an array");
ok(validateFeed({ generated: "5", items: [] }) === null, "generated must be a number");
ok(validateFeed({ generated: 5, items: Array(61).fill(it) }) === null, "more than 60 items is rejected");
ok(validateFeed({ generated: 5, items: Array(60).fill(it) }) !== null, "60 items is accepted");
ok(validateFeed(mk({ t: "1" })) === null && validateFeed(mk({ t: NaN })) === null, "t must be a finite number");
ok(validateFeed(mk({ code: "x".repeat(41) })) === null, "over-long strings are rejected");
ok(validateFeed(mk({ acct: 3 })) === null && validateFeed(mk({ cat: "" })) === null, "non-string and empty fields are rejected");
ok(validateFeed(mk({ code: "a@b.co" })) === null && validateFeed(mk({ code: "https://x" })) === null, "email and URL strings are rejected");
ok(!("extra" in validateFeed({ generated: 5, items: [{ ...it, extra: "leak" }] }).items[0]), "unknown keys are stripped");

// fallback: ReceiptFeed only calls setFeed with a validated value, so a failure leaves the first-paint items
const src = R("components/hud/ReceiptFeed.tsx");
ok(/useState<[^>]*>\(FEED\)/.test(src), "first paint uses the build-time FEED import");
ok(/catch \{\}/.test(src) && /if \(v\) setFeed\(v\)/.test(src), "fetch or validation failure keeps the current items");
ok(/cache: "no-store"/.test(src) && /\/hud\/feed\.json\?ts=\$\{Date\.now\(\)\}/.test(src), "polls /hud/feed.json with a cache-buster and no-store");
ok(/setInterval\(pull, 60000\)/.test(src) && /document\.hidden/.test(src), "polls every 60 s and pauses when the tab is hidden");
ok(/clearInterval/.test(src), "the timer is cleared on unmount");
ok(/prefers-reduced-motion:reduce\)\{.*hud-feed-row\{animation:none/.test(R("components/hud/HudStyle.tsx")), "reduced motion switches the row animation off");

// the public copy
ok(existsSync(new URL("public/hud/feed.json", root)), "public/hud/feed.json exists");
ok(R("public/hud/feed.json") === R("lib/hud/feed.json"), "public/hud/feed.json equals lib/hud/feed.json");
ok(/sync_hud_feed/.test(R("package.json")), "prebuild copies the feed into public/");
const built = new URL("out/hud/feed.json", root);
if (existsSync(built)) ok(R("out/hud/feed.json") === R("lib/hud/feed.json"), "build output out/hud/feed.json equals the source feed");
else console.log("SKIP build output check (no out/ yet; postbuild run covers it)");

// nothing identifying
const text = JSON.stringify(good.items);
ok(!/@|https?:|www\.|\.(com|au|org|net|io|gov)\b/i.test(text), "no email, URL or domain in feed items");
ok(good.items.every((x) => /^[A-Za-z0-9-]+$/.test(x.code) && /^[A-Z]+$/.test(x.cat) && /^[AB]$/.test(x.acct)), "codenames are bare tokens, categories and accounts are fixed shapes");
ok(!/ariance|kyle|titanos|austender|investor|council|client|whale|prospect|abn/i.test(text), "no organisation or person word in feed items");

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
