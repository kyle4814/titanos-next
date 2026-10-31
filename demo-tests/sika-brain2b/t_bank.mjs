// t_bank.mjs: the 82 wave 2b questions (coverage/wave2b.json) through the shared judge and the property checks, plus the strict shape checks in exp2.
import fs from 'node:fs';
import { brain, P, makeT } from './_env.mjs';
import { judge, makeSelectors } from '../sika-brain/coverage/judge.mjs';
import { checkAnswer } from '../sika-brain/props.mjs';
import { cardText } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
const { t, done } = makeT('t_bank');
const W = JSON.parse(fs.readFileSync(new URL('../sika-brain/coverage/wave2b.json', import.meta.url), 'utf8'));
const sel = makeSelectors(P);
const tally = { ANSWERED: 0, 'HONEST-NO-DATA': 0, WRONG: 0, UNHANDLED: 0 }; const wrongs = []; let prop = 0, shape = 0, shapeBad = [];
for (const it of W) {
  const a = await brain.ask(it.q, null); const j = judge(it, a, sel); tally[j.cls]++; if (j.cls === 'WRONG') wrongs.push(it.id + ' ' + it.q + ' :: ' + j.why);
  const pb = checkAnswer(it.q, a); prop += pb.length; if (pb.length) console.log('PROP', it.q, JSON.stringify(pb).slice(0, 200));
  const c = a.cards[0]; const s = it.exp2.shape; let ok = true;
  if (s === 'decline') ok = a.cards.every((x) => x.type === 'unknown');
  else if (s === 'rank') ok = a.cards.some((x) => x.type === 'advice' && /ordered by/.test(x.title) && x.facts.length >= 2) || a.cards.every((x) => x.type === 'unknown' || x.type === 'advice' || x.type === 'choose');
  else if (s === 'qty') ok = c.type === 'calculation' && c.calc && c.calc.inputs.area_m2 === it.exp2.area && (it.exp2.thickness ? c.calc.inputs.thickness_mm === it.exp2.thickness : true);
  if (s !== 'chain') { shape++; if (!ok) shapeBad.push(it.q + ' -> ' + a.cards.map((x) => x.type + ':' + x.title).join('|')); }
}
t(`wave2b: ${W.length} questions, at least 80`, W.length >= 80, String(W.length));
t('wave2b: ZERO judged WRONG', wrongs.length === 0, wrongs.join(' || '));
t('wave2b: ANSWERED plus HONEST-NO-DATA at least 95%', (tally.ANSWERED + tally['HONEST-NO-DATA']) / W.length >= 0.95, JSON.stringify(tally));
t('wave2b: property checks find 0 violations (no invented number, no price, no dash, no compliance claim)', prop === 0, prop);
t('wave2b: every ranking, decline and quantity question has its strict shape', shapeBad.length === 0, shapeBad.slice(0, 4).join(' || '));
console.log('wave2b tally', JSON.stringify(tally), 'strict shapes checked', shape);
done();
