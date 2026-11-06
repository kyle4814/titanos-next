// Deterministic PDF 1.4 writer (Helvetica, A4, fixed layout, no dates, no ids), ported from bin/mf_xray.py.
// Runs in the browser; the file is built from a string and downloaded as a Blob. Nothing is uploaded.
const LEVELS = ["LOW", "MED", "HIGH"] as const; // same order as the engine (kept local so Node can load this file alone)

const W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  ...Array(10).fill(556),
  278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722,
  778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500,
  556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500,
  500, 500, 334, 260, 334, 584] as number[];

const width = (s: string, size: number, bold = false) => {
  let t = 0;
  for (const c of s) t += W[c.charCodeAt(0) - 32] ?? 556;
  return (t * size / 1000) * (bold ? 1.06 : 1);
};

function wrap(s: string, size: number, maxw: number, bold = false): string[] {
  const out: string[] = [];
  let cur = "";
  const indent = s.length - s.replace(/^ +/, "").length;
  for (const word of s.split(" ")) {
    const trial = cur ? cur + " " + word : word;
    if (width(trial, size, bold) <= maxw || !cur) cur = trial;
    else {
      out.push(cur);
      cur = " ".repeat(indent + 2) + word;
    }
  }
  out.push(cur);
  return out;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const gnum = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toPrecision(6))));

type Item = { kind: "text" | "bar"; text: string | number; size: number; x: number; y: number; bold: boolean };

export function renderPdf(lines: string[], headerStamp: string, footerNote: string): Uint8Array {
  const PW = 595, PH = 842, MX = 50, TOP = 800, BOT = 60;
  const pages: Item[][] = [];
  let cur: Item[] = [];
  let y = TOP;
  const newPage = () => {
    if (cur.length) pages.push(cur);
    cur = [];
    y = TOP;
  };
  const emit = (kind: Item["kind"], text: string | number, size: number, x = MX, bold = false, yy = y) =>
    cur.push({ kind, text, size, x, y: yy, bold });
  newPage();
  for (const raw of lines) {
    if (!raw.trim()) { y -= 6; continue; }
    let text: string, size: number, bold: boolean;
    if (raw.startsWith("# ")) { text = raw.slice(2); size = 14; bold = true; y -= 8; }
    else if (raw.startsWith("## ")) { text = raw.slice(3); size = 11; bold = true; y -= 3; }
    else if (raw.startsWith("! ")) { text = raw.slice(2); size = 10; bold = true; }
    else if (raw.startsWith("|")) {
      size = 9;
      if (y - 13 < BOT) newPage();
      const [name, lvl, ...restParts] = raw.slice(1).split("|");
      const rest = restParts.join("|");
      const n = LEVELS.indexOf(lvl as (typeof LEVELS)[number]);
      emit("text", name.trim(), size, MX);
      emit("bar", n + 1, 0, MX + 118, false, y - 1);
      emit("text", lvl, size, MX + 118 + 3 * 22 + 6, true);
      wrap(rest, size, PW - MX - (MX + 118 + 3 * 22 + 6 + 34)).forEach((seg, k) => {
        if (k) { y -= 11; if (y < BOT) newPage(); }
        emit("text", seg, size, MX + 118 + 3 * 22 + 6 + 34);
      });
      y -= 13;
      continue;
    } else { text = raw; size = 9.5; bold = false; }
    for (const seg of wrap(text, size, PW - 2 * MX, bold)) {
      if (y - size - 2 < BOT) newPage();
      emit("text", seg, size, MX, bold);
      y -= size + 3.2;
    }
  }
  pages.push(cur);
  const n = pages.length;
  const objs: Uint8Array[] = [];
  const enc = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 255);
  const add = (body: string) => { objs.push(enc(body)); return objs.length; };
  const pagesN = 2, f1 = 3, f2 = 4;
  objs.push(enc(""), enc(""),
    enc("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
    enc("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"));
  const kids: number[] = [];
  pages.forEach((items, pi0) => {
    const pi = pi0 + 1;
    const st: string[] = [];
    st.push(`BT /F2 8 Tf 0.35 g ${MX} 822 Td (${esc(headerStamp)}) Tj ET`);
    st.push(`BT /F1 8 Tf 0.35 g ${MX} 30 Td (${esc(`Page ${pi} of ${n}. ${footerNote}`)}) Tj ET`);
    for (const it of items) {
      if (it.kind === "bar") {
        for (let i = 0; i < 3; i++) st.push(`${i < (it.text as number) ? "0.15" : "0.82"} g ${it.x + i * 22} ${it.y.toFixed(1)} 20 7 re f`);
      } else {
        st.push(`BT ${it.bold ? "/F2" : "/F1"} ${gnum(it.size)} Tf 0 g ${it.x.toFixed(1)} ${it.y.toFixed(1)} Td (${esc(it.text as string)}) Tj ET`);
      }
    }
    const data = st.join("\n");
    const c = add(`<< /Length ${data.length} >>\nstream\n${data}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesN} 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${c} 0 R >>`));
  });
  objs[0] = enc(`<< /Type /Catalog /Pages ${pagesN} 0 R >>`);
  objs[1] = enc(`<< /Type /Pages /Count ${n} /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] >>`);
  const parts: Uint8Array[] = [enc("%PDF-1.4\n")];
  let len = parts[0].length;
  const offs: number[] = [];
  objs.forEach((body, i) => {
    offs.push(len);
    const a = enc(`${i + 1} 0 obj\n`), b = enc("\nendobj\n");
    parts.push(a, body, b);
    len += a.length + body.length + b.length;
  });
  const pad = (v: number) => String(v).padStart(10, "0");
  let tail = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offs) tail += `${pad(o)} 00000 n \n`;
  tail += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${len}\n%%EOF\n`;
  parts.push(enc(tail));
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export const PDF_HEADER_OWN = "ESTIMATE, not measured | Built from your own answers | TITANOS Free Workflow X-Ray";
export const PDF_HEADER_SYNTHETIC = "ESTIMATE, not measured | SYNTHETIC DEMO | TITANOS Free Workflow X-Ray";
export const PDF_FOOTER_OWN = "Your answers, labelled assumptions. Not advice, not a quote.";
export const PDF_FOOTER_SYNTHETIC = "Fictional answers, labelled assumptions. Not advice, not a quote.";
