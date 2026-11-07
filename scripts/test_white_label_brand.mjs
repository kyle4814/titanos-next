// node scripts/test_white_label_brand.mjs  (WLB_LIB overrides the module path; used by the mutant runner)
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const libPath = process.env.WLB_LIB ? resolve(process.env.WLB_LIB) : join(root, "lib", "white-label-brand.ts");
const L = await import(pathToFileURL(libPath).href);

let fails = 0;
let n = 0;
const ok = (name, cond, extra = "") => { n++; if (!cond) { fails++; console.error(`FAIL ${name} ${extra}`); } };
const eq = (name, a, b) => ok(name, a === b, `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);

// synthetic partner: Example Partner Pty Ltd (not a real business)
const good = { name: "Example Partner", accent: "#0b5cad", logoUrl: "https://cdn.titanos.tech/partners/example.png", footer: "Example Partner Pty Ltd, synthetic test data" };

// contrast maths
eq("ratio black/white", Math.round(L.contrastRatio("#000", "#fff") * 100) / 100, 21);
eq("ratio same", L.contrastRatio("#abc", "#abc"), 1);
ok("default accent passes AA", L.contrastRatio(L.DEFAULT_ACCENT, "#ffffff") >= 4.5);

// boundaries: #767676 is the lightest grey passing AA on white (4.54), #777777 fails (4.48)
let r = L.validateBrand({ ...good, accent: "#767676" });
eq("767676 kept", r.brand.accent, "#767676"); eq("767676 reason", r.accentReason, null);
r = L.validateBrand({ ...good, accent: "#777777" });
eq("777777 falls back", r.brand.accent, L.DEFAULT_ACCENT);
ok("777777 reason", /^accent_low_contrast:4\.48<4\.5$/.test(r.accentReason ?? ""), r.accentReason);
r = L.validateBrand({ ...good, accent: "#fff" });
ok("white on white fails", r.accentReason?.startsWith("accent_low_contrast:1.00"), r.accentReason);
r = L.validateBrand({ ...good, accent: "#000" });
eq("short hex normalised", r.brand.accent, "#000000");
r = L.validateBrand({ ...good, accent: "#ABCDEF" });
eq("light blue fails on white", r.brand.accent, L.DEFAULT_ACCENT);
// dark background: a light accent now passes, the default dark one fails and the fallback flips
r = L.validateBrand({ ...good, accent: "#ffffff" }, { background: "#101010" });
eq("white accent on dark ok", r.brand.accent, "#ffffff");
r = L.validateBrand({ ...good, accent: "#222222" }, { background: "#101010" });
eq("dark on dark falls to safe fallback", r.brand.accent, "#ffffff");
r = L.validateBrand(good, { background: "nope" });
eq("bad background -> white", r.brand.background, "#ffffff"); ok("bad background issue", r.issues.includes("background_invalid_using_white"));

// an unsafe defaultAccent is itself replaced by black or white
eq("unsafe default accent replaced", L.validateBrand({ name: "X", accent: "#ffff00" }, { defaultAccent: "#ffff00" }).brand.accent, "#000000");

// accent format
for (const bad of ["red", "#12", "#12345", "#gggggg", "rgb(0,0,0)", "#000000;background:url(x)", "#000\"onload=", 123, {}]) {
  r = L.validateBrand({ ...good, accent: bad });
  eq(`accent bad ${JSON.stringify(bad)}`, r.accentReason, "accent_invalid_format");
  eq(`accent bad fallback ${JSON.stringify(bad)}`, r.brand.accent, L.DEFAULT_ACCENT);
}
eq("accent missing reason", L.validateBrand({ name: "X" }).accentReason, "accent_missing");

// markup stripping
const inj = [
  ["<script>alert(1)</script>Acme", "alert(1)Acme"],
  ["<b>Acme</b> <i>Co</i>", "Acme Co"],
  ["Acme<img src=x onerror=alert(1)>", "Acme"],
  ["<<script>script>x<</script>/script>Acme", "scriptx/scriptAcme"],
  ["Acme <svg/onload=alert(1)", "Acme"],
  ["Acme\u0000\n\tCo", "Acme Co"],
];
for (const [i, want] of inj) {
  const s = L.stripMarkup(i, 60);
  ok(`strip no angle ${JSON.stringify(i)}`, !/[<>]/.test(s), s);
  if (want !== null) eq(`strip ${JSON.stringify(i)}`, s, want);
}
eq("strip non-string", L.stripMarkup(42, 10), "");
eq("strip cap", L.stripMarkup("a".repeat(100), 60).length, 60);
r = L.validateBrand({ name: "<script>x</script>", accent: "#000" });
ok("script-only-name leaves text, ok", r.ok && !/[<>]/.test(r.brand.name));
r = L.validateBrand({ name: "<b></b>", accent: "#000" });
eq("empty name not ok", r.ok, false); eq("empty name fallback", r.brand.name, L.FALLBACK_NAME); ok("name issue", r.issues.includes("name_required"));
r = L.validateBrand(null);
eq("null input not ok", r.ok, false);
r = L.validateBrand({ name: "N".repeat(200), footer: "F".repeat(500) });
eq("name capped", r.brand.name.length, L.NAME_MAX); eq("footer capped", r.brand.footer.length, L.FOOTER_MAX);

// logo allowlist
const logoCases = [
  ["https://cdn.titanos.tech/a.png", true],
  ["https://img.cdn.titanos.tech/a.SVG", true],
  ["http://cdn.titanos.tech/a.png", "logo_not_https"],
  ["https://evil.com/a.png", "logo_host_not_allowlisted"],
  ["https://cdn.titanos.tech.evil.com/a.png", "logo_host_not_allowlisted"],
  ["https://evilcdn.titanos.tech/a.png", "logo_host_not_allowlisted"],
  ["https://user:pw@cdn.titanos.tech/a.png", "logo_credentials"],
  ["https://cdn.titanos.tech:8443/a.png", "logo_port"],
  ["https://cdn.titanos.tech/a.png?track=1", "logo_query_or_fragment"],
  ["https://cdn.titanos.tech/a.png#x", "logo_query_or_fragment"],
  ["https://cdn.titanos.tech/a.html", "logo_not_image"],
  ["javascript:alert(1)", "logo_not_https"],
  ["data:image/png;base64,AAAA", "logo_not_https"],
  ["//cdn.titanos.tech/a.png", "logo_unparseable"],
  ["https://cdn.titanos.tech/a.png\" onerror=\"x", "logo_bad_chars"],
  ["https://cdn.titanos.tech/" + "a".repeat(600) + ".png", "logo_too_long"],
  [42, "logo_not_string"],
];
for (const [u, want] of logoCases) {
  r = L.validateBrand({ ...good, logoUrl: u });
  if (want === true) eq(`logo ok ${u}`, r.brand.logoUrl !== null, true);
  else { eq(`logo null ${String(u).slice(0, 40)}`, r.brand.logoUrl, null); ok(`logo issue ${want}`, r.issues.includes(want), r.issues.join()); }
}
eq("custom allowlist", L.validateBrand({ ...good, logoUrl: "https://partner.example/l.png" }, { logoHosts: ["partner.example"] }).brand.logoUrl, "https://partner.example/l.png");
eq("no logo is fine", L.validateBrand({ name: "X", accent: "#000" }).issues.length, 0);

// golden outputs
const g = L.renderBrandedFrame(good);
eq("golden header", g.html.header,
  '<header style="font-family:Helvetica,Arial,sans-serif;background:#ffffff;padding:16px 0;border-bottom:3px solid #0b5cad">' +
  '<img src="https://cdn.titanos.tech/partners/example.png" alt="Example Partner logo" height="40" style="height:40px;width:auto;vertical-align:middle;margin-right:12px">' +
  '<span style="color:#0b5cad;font-size:22px;font-weight:700;vertical-align:middle">Example Partner</span></header>');
eq("golden footer", g.html.footer,
  '<footer style="font-family:Helvetica,Arial,sans-serif;background:#ffffff;padding:12px 0;border-top:1px solid #0b5cad;font-size:13px">' +
  '<p style="margin:0 0 6px 0;color:#1a1a1a">Example Partner Pty Ltd, synthetic test data</p>' +
  '<p style="margin:0;color:#1a1a1a">Prepared with TITANOS (<a href="https://titanos.tech" style="color:#0b5cad">titanos.tech</a>)</p></footer>');
eq("golden text header", g.text.header, "Example Partner\n===============");
eq("golden text footer", g.text.footer, "--\nExample Partner Pty Ltd, synthetic test data\nPrepared with TITANOS (titanos.tech)");

// attribution always present, whatever the partner sends
for (const f of ["", "   ", "<b></b>", "Hello", "Prepared with someone else"]) {
  const x = L.renderBrandedFrame({ ...good, footer: f });
  ok(`attribution html footer=${JSON.stringify(f)}`, x.html.footer.includes("Prepared with TITANOS"));
  ok(`attribution text footer=${JSON.stringify(f)}`, x.text.footer.endsWith("Prepared with TITANOS (titanos.tech)"));
}
ok("attribution survives null input", L.renderBrandedFrame(null).html.footer.includes("Prepared with TITANOS"));
ok("no empty footer paragraph", !L.renderBrandedFrame({ ...good, footer: "" }).html.footer.includes("margin:0 0 6px"));

// injection through render
const evil = { name: '"><script>alert(1)</script>', accent: '#000;background:url(//evil)', logoUrl: 'https://cdn.titanos.tech/a.png"><img src=//evil/p.gif width=1>', footer: "<img src=//evil/p.gif width=1 height=1><iframe src=x></iframe>&<'\"" };
const e = L.renderBrandedFrame(evil);
const allHtml = e.html.header + e.html.footer;
eq("evil clean", L.findForbidden(allHtml).join(), "");
ok("evil no script text", !/<script/i.test(allHtml));
ok("evil no evil host", !allHtml.includes("evil"), allHtml);
ok("evil escapes ampersand", e.html.footer.includes("&amp;"));
const amp = L.renderBrandedFrame({ ...good, name: "A & B 'Co' \"x\"" });
ok("escapes entities", amp.html.header.includes("A &amp; B &#39;Co&#39; &quot;x&quot;"));
ok("alt escaped", amp.html.header.includes('alt="A &amp; B &#39;Co&#39; &quot;x&quot; logo"'));

// forbidden-pattern detector itself
for (const [k, h] of [["script", "<script src=x>"], ["iframe", "<iframe>"], ["link", "<link rel=stylesheet>"], ["event_handler", '<a onclick="x">'], ["js_url", '<a href="javascript:x">'], ["tiny_pixel", '<img width="1" height="1">'], ["css_url", "background:url(x)"], ["second_img", "<img a><img b>"]])
  ok(`detector ${k}`, L.findForbidden(h).includes(k), L.findForbidden(h).join());
eq("detector clean on golden", L.findForbidden(allHtml + g.html.header + g.html.footer).length, 0);
ok("render never has a pixel or script (good)", L.findForbidden(g.html.header + g.html.footer).length === 0);
ok("only one img in header", (g.html.header.match(/<img/g) || []).length === 1 && !g.html.footer.includes("<img"));

// determinism
eq("deterministic", JSON.stringify(L.renderBrandedFrame(good)), JSON.stringify(L.renderBrandedFrame(good)));
// low-contrast accent still renders the safe colour only
const lc = L.renderBrandedFrame({ ...good, accent: "#ffff00" });
ok("lc uses fallback in html", lc.html.header.includes(L.DEFAULT_ACCENT) && !lc.html.header.includes("ffff00"));
ok("lc reason reported", (lc.accentReason ?? "").startsWith("accent_low_contrast"));

// copy lint: no em/en dashes in rendered output or the lib source
const { readFileSync } = await import("node:fs");
ok("no em/en dash in lib", !/[–—]/.test(readFileSync(libPath, "utf8")));

if (fails) { console.error(`white-label-brand: ${fails} FAILED of ${n}`); process.exit(1); }
console.log(`white-label-brand: ${n} checks OK`);
