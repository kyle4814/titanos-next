// gen_sample.mjs: a fixed sample of golden questions (every 15th) for the in-browser speed test. node gen_sample.mjs
import fs from 'node:fs'; import { generate } from './golden_gen.mjs';
const Q = generate().filter((_, i) => i % 15 === 0).map((x) => x.q); fs.writeFileSync(new URL('./sample_questions.json', import.meta.url), JSON.stringify(Q)); console.log(Q.length);
