// convo_probe.mjs: the conversation probes (social, vague, chatty, typo'd). Prints "Q | first card title | first card headline + lines" per probe.
// Usage: node convo_probe.mjs            (probe list below)   |   node convo_probe.mjs "q1" "q2"   (ad hoc, each its own conversation)
import { makeBrain } from './harness.mjs';
import { cardText } from '../../public/demo/sika-210c0c/assets/brain/schema.js';
export const BASE_PROBES = ['hello', 'hi mate how are you', 'thanks', 'what do you recommend for my bathroom', 'can you recommend a sealant', "what's good for a balcony leak", 'I need something to fix a crack'];
export const MORE_PROBES = ['hey can u help', 'g\'day', 'cheers mate', 'who are you', 'what can you do', 'you are useless', 'ok', 'need sumthing for shower leak', 'whats best for gluing timber', 'what should i use for my kitchen splashback', 'garage floor', 'pool', 'i need an adhesive', 'waterproofing', 'whats the best sealent for a bathrm', 'recommend something for tiles on a balcony', 'what do you recommend', 'good morning', 'bye', 'yes', 'my roof is leaking what do i use', 'got a leaky shower any ideas', 'which grout is best for a shower floor'];
export const first = (a) => { const c = a.cards[0]; if (!c) return '(no card)'; return `[${c.type}] ${c.title} :: ${cardText(c).replace(/\s+/g, ' ').slice(0, 330)}${(a.followups && a.followups.length) ? ' || chips: ' + a.followups.slice(0, 5).join(' / ') : ''}`; };
if (process.argv[1] && process.argv[1].endsWith('convo_probe.mjs')) {
  const brain = makeBrain();
  const qs = process.argv.length > 2 ? process.argv.slice(2) : [...BASE_PROBES, ...MORE_PROBES];
  for (const q of qs) { const a = await brain.ask(q, null); console.log(`Q: ${q}\n   ${first(a)}\n`); }
}
