// convo_opts.mjs: every clarifier option, asked on its own, must come back as a published answer (never "not in the documentation"). Prints the first card of each; exit 1 on any unknown.
import { makeBrain } from './harness.mjs';
import { PLACES } from '../../public/demo/sika-210c0c/assets/brain/chat.js';
const brain = makeBrain(); let bad = 0, n = 0;
for (const p of PLACES) for (const o of p.opts) { n++; const a = await brain.ask(o.q, null); const c = a.cards[0]; const ok = c && c.type !== 'unknown' && c.type !== 'choose'; if (!ok || process.env.ALL) console.log(`${ok ? 'ok ' : 'BAD'} ${p.id} | ${o.q} -> [${c && c.type}] ${c && c.title}`); if (!ok) bad++; }
console.log(`convo_opts: ${n - bad}/${n} options answered`); process.exit(bad ? 1 : 0);
