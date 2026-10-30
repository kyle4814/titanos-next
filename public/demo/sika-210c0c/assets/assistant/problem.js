// problem.js (T22): the problem solver intent. It answers only from data/knowledge/problems.json, which is built from verbatim passages
// of the published product pages (sika-demo-qa/build_problems.mjs). It never diagnoses. When the passages run out it hands off (T06).
import { normalise } from './tokenize.js';
import { buildHandoff } from './handoff.js';

/** The chip whose symptom words match the question, or null. */
export function detectProblem(text, problems) {
  if (!problems || !Array.isArray(problems.chips)) return null;
  const n = normalise(text);
  for (const c of problems.chips) {
    if (!c.askRx) continue;
    try { if (new RegExp(c.askRx, 'i').test(n)) return c; } catch { /* a bad pattern in the data file is skipped */ }
  }
  return null;
}

/** Blocks for one chip: the published passages with sources, then the hand-off because the tree always ends there. */
export function problemBlocks(chip, { query, config }) {
  const label = chip.label.toLowerCase();
  const blocks = [];
  if (chip.items.length) {
    blocks.push({ type: 'text', text: `I cannot diagnose "${label}" from here. The published product pages mention it in ${chip.items.length} place${chip.items.length === 1 ? '' : 's'}; here is what they say, word for word.` });
    blocks.push({ type: 'facts', title: `What the published pages say (${chip.label})`, rows: chip.items.map((i) => ({ label: i.name, value: `"${i.quote}"`, source: { label: 'product page', url: i.url } })) });
  } else {
    blocks.push({ type: 'text', text: `The published product pages I hold do not say anything about "${label}". I will not guess.` });
  }
  const products = chip.products.slice(0, 3);
  blocks.push(buildHandoff({ query, products, reason: chip.items.length ? 'This is as far as the published text goes. It does not diagnose your job.' : 'This is not in the published data I hold.', config }));
  return blocks;
}
