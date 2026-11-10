// Report trace checker (C3). Given the store record and a rendered report (markdown and JSON), it returns every
// violation of the "no unlabelled or untraceable number" bar. Empty array = the report is clean.
// It reads the store only: zero model calls, no clock, no network.
import { computeLevel, BADGE_MIN_LEVEL } from "./levels.ts";
import { ctxOf, type DomainState } from "./engine.ts";
import type { ScanResult } from "../../../lib/guestscan/scan.ts";

type Rep = { markdown: string; json: any };
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function checkReportTrace(s: DomainState, now: number, rep: Rep): string[] {
  const v: string[] = [];
  const md = rep.markdown, j = rep.json;
  const fs = Object.values(s.findings);

  // ---- (3) hours: recomputed from the recorded findings, labelled MODELLED with method and floor ----
  const expMin = fs.filter((f) => f.state === "PROVEN_FIXED" && f.credited).reduce((a, f) => a + f.minutesByHand - f.minutesWithPlan, 0);
  const expHours = Math.round((expMin / 60) * 10) / 10;
  if (j.hours.minutes !== expMin) v.push(`hours: json minutes ${j.hours.minutes} != recorded proven minutes ${expMin}`);
  if (j.hours.hours !== expHours) v.push(`hours: json hours ${j.hours.hours} != ${expHours} (minutes/60, one decimal, nearest)`);
  if (!/^MODELLED\b/.test(j.hours.label ?? "")) v.push("hours: json label does not start with MODELLED");
  if (!/lib\/guestscan\/fixes\.ts/.test(j.hours.label ?? "")) v.push("hours: json label has no method line (the table it comes from)");
  if (!/^Floor: 0 hours/.test(j.hours.floor ?? "")) v.push("hours: json has no floor line");
  const hl = md.split("\n").find((l) => /hours \(\d+ minutes\)/.test(l)) ?? "";
  if (!hl) v.push("hours: markdown has no hours line");
  else {
    if (!hl.includes(`${j.hours.hours} hours (${j.hours.minutes} minutes)`)) v.push(`hours: markdown figure differs from json (${hl.slice(0, 40)})`);
    if (!/MODELLED/.test(hl)) v.push("hours: markdown hours line is not labelled MODELLED");
    if (!hl.includes(j.hours.label)) v.push("hours: markdown does not carry the method line");
    if (!/Floor: 0 hours/.test(hl)) v.push("hours: markdown does not carry the floor");
    if (/\$|\b(AUD|USD|dollars?|measured|earned|saved|received)\b/i.test(hl.split(j.hours.label).join(" ").split(j.hours.floor).join(" "))) v.push("hours: rendered as money or as measured");
  }

  // ---- (1) parity: every figure in the markdown equals the JSON figure ----
  const mm = /Business Level (\d+) of 10 \((.+?)\)\./.exec(md);
  if (!mm || Number(mm[1]) !== j.level || mm[2] !== j.levelName) v.push("parity: level line differs");
  if (j.level !== s.level) v.push(`trace: level ${j.level} != store level ${s.level}`);
  const ls = /Last scan: (?:(\d{4}-\d\d-\d\d), grade (\S+), score (\d+)|none yet)\./.exec(md);
  if (!ls) v.push("parity: last scan line missing");
  else if (j.lastScan ? (ls[1] !== j.lastScan.date || ls[2] !== j.lastScan.grade || Number(ls[3]) !== j.lastScan.score) : ls[1] !== undefined) v.push("parity: last scan differs");
  if (s.lastScan ? (!j.lastScan || j.lastScan.date !== iso(s.lastScan.at) || j.lastScan.score !== s.lastScan.score || j.lastScan.grade !== s.lastScan.grade) : j.lastScan !== null) v.push("trace: last scan does not match the store scan record");
  if (j.date !== iso(now) || !md.includes(`Date: ${j.date}.`)) v.push("parity/trace: report date");
  if (j.findings.length !== fs.length) v.push("parity: finding count differs from store");
  fs.forEach((f, i) => {
    const jf = j.findings[i];
    if (!jf || jf.check !== f.check || jf.state !== f.state || jf.evidence !== f.detail) { v.push(`trace: finding row ${i} (${f.check}) differs from the store record`); return; }
    const line = md.split("\n").find((l) => l.startsWith(`- ${f.check}: `)) ?? "";
    if (!line.startsWith(`- ${f.check}: ${f.state}`)) v.push(`parity: markdown state for ${f.check} differs`);
    if (!line.endsWith(`Evidence: ${f.detail}`)) v.push(`parity: markdown evidence for ${f.check} differs`);
    if (f.state === "PROVEN_FIXED") {
      if (!f.proof || f.provenAt === undefined) v.push(`trace: ${f.check} is PROVEN_FIXED with no proof record`);
      else if (!line.includes(`Proven by re-scan ${f.proof.scanId} on ${iso(f.provenAt)}.`)) v.push(`trace: ${f.check} proof line does not name the recorded scan and date`);
    } else {
      // ---- (4) anything not proven must never read as proven ----
      if (/Proven by/.test(line)) v.push(`not-fixed: ${f.check} is ${f.state} but the report says it is proven`);
      if (jf.provenScanId || jf.provenDate) v.push(`not-fixed: ${f.check} json still carries a proof`);
    }
    if (f.state === "REGRESSED" && f.regressedAt !== undefined && !line.includes(`The fault returned on ${iso(f.regressedAt)}.`)) v.push(`trace: ${f.check} regression date`);
  });

  // fixes: an undone, rolled-back, partial fix or a returned fault is never shown as a fix that worked
  if (j.fixes.length !== s.fixes.length) v.push("parity: fix count differs from store");
  s.fixes.forEach((x, i) => {
    const jx = j.fixes[i]; const state = s.findings[x.check]?.state;
    const stands = x.status === "proven" && state === "PROVEN_FIXED";
    const line = `- ${x.check}: ${x.note} (${jx?.shown}).`;
    if (!jx || jx.note !== x.note || jx.check !== x.check) v.push(`trace: fix ${x.id} differs from store`);
    else if (!md.includes(line)) v.push(`parity: markdown fix line for ${x.id} differs`);
    if (!stands && jx && /^proven$/.test(jx.shown)) v.push(`not-fixed: fix ${x.id} (${x.status}, finding ${state}) is shown as proven`);
    if (!stands && jx && !/not fixed|not proven|applied/.test(jx.shown)) v.push(`not-fixed: fix ${x.id} not shown as not fixed (${jx.shown})`);
    if (stands && jx?.shown !== "proven") v.push(`trace: standing fix ${x.id} not shown proven`);
  });

  // badge: must equal what the recorded findings earn, and be absent when they do not
  const eff: ScanResult = { domain: s.domain, findings: fs.map((f) => ({ check: f.check, status: f.status, detail: f.detail, fix: f.fix })), grade: (s.lastScan?.grade ?? "F") as ScanResult["grade"], score: s.lastScan?.score ?? 0, elapsedMs: 0, modelCalls: 0 };
  if (s.lastScan) {
    const lv = computeLevel(eff, ctxOf(s, now)).level; const want = lv >= BADGE_MIN_LEVEL ? lv : 0;
    if ((j.badge?.level ?? 0) !== want) v.push(`not-fixed: badge L${j.badge?.level ?? 0} does not match the recorded findings (earn L${want})`);
  }
  if ((j.badge === null) !== (s.badge === undefined)) v.push("trace: badge presence differs from store");
  if (j.badge === null ? !md.includes("No badge held right now.") : !md.includes(`Level ${j.badge.level} badge held since ${j.badge.sinceDate}.`)) v.push("parity: badge line differs");
  if (j.badge && (j.badge.since !== s.badge!.since || j.badge.scanId !== s.badge!.scanId || j.badge.sinceDate !== iso(s.badge!.since))) v.push("trace: badge since/scan differs from store");
  const lost = s.badgeHistory.filter((b) => b.lostBecause);
  if (j.badgeLost.length !== lost.length) v.push("parity: badge-lost count differs");
  lost.forEach((b, i) => { if (!md.includes(`- Level ${b.level} badge lost on ${iso(b.to!)}: ${b.lostBecause}.`)) v.push(`trace: badge-lost row ${i}`); });

  // ---- (2) every remaining number in the markdown maps to a recorded value ----
  let rest = md;
  for (const span of [...fs.map((f) => f.detail), ...s.fixes.map((x) => x.note), ...lost.map((b) => b.lostBecause!), j.hours.label, j.hours.floor, s.domain, s.domainId]) if (span) rest = rest.split(span).join(" ");
  const dates = new Set<string>([iso(now)]);
  const addT = (t?: number) => { if (t !== undefined) dates.add(iso(t)); };
  addT(s.lastScan?.at); fs.forEach((f) => { addT(f.provenAt); addT(f.regressedAt); }); addT(s.badge?.since); s.badgeHistory.forEach((b) => { addT(b.from); addT(b.to); }); s.events.forEach((e) => addT(e.at));
  rest = rest.replace(/\b\d{4}-\d\d-\d\d\b/g, (d) => { if (!dates.has(d)) v.push(`number: date ${d} has no recorded timestamp`); return " "; });
  rest = rest.replace(/\bscn_(\d+)\b/g, (m, n) => { if (!fs.some((f) => f.proof?.scanId === m) || Number(n) > s.scans) v.push(`number: ${m} is not a recorded scan`); return " "; });
  const nums = new Set<number>([s.level, 10, expMin, expHours, ...(s.lastScan ? [s.lastScan.score] : []), ...(s.badge ? [s.badge.level] : []), ...s.badgeHistory.map((b) => b.level)]);
  for (const m of rest.match(/\d+(?:\.\d+)?/g) ?? []) if (!nums.has(Number(m))) v.push(`number: ${m} in the markdown maps to no recorded finding, fix, scan or badge`);

  // json: every numeric leaf is a recorded figure
  const tsOK = new Set<number>([...[s.lastScan?.at, s.badge?.since, ...s.badgeHistory.flatMap((b) => [b.from, b.to])].filter((x): x is number => x !== undefined)]);
  const walk = (o: any, path: string) => {
    if (typeof o === "number") { if (!nums.has(o) && !tsOK.has(o)) v.push(`number: json ${path} = ${o} maps to no recorded figure`); }
    else if (Array.isArray(o)) o.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (o && typeof o === "object") for (const [k, x] of Object.entries(o)) walk(x, `${path}.${k}`);
  };
  walk(j, "json");
  return v;
}
