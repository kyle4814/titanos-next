// WCAG AA guard: every text-role token must clear 4.5:1 on every surface token. Run via `npm test`.
import fs from "node:fs";
const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const tok = (n) => css.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
let fail = 0;
for (const fg of ["text", "dim", "gold", "gold-dim", "steel", "ice"])
  for (const bg of ["vault-black", "vault-warm", "vault-cool"]) {
    const a = tok(fg), b = tok(bg);
    const r = a && b ? ratio(a, b) : 0;
    const good = r >= 4.5; if (!good) fail++;
    console.log(`${good ? "PASS" : "FAIL"} --${fg} on --${bg} ${r.toFixed(2)}`);
  }
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
