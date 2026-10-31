// Room parser: 20+ phrasings (metres, millimetres, decimals, comma decimals, "by", missing height, two substrates, tile sizes that are NOT rooms).
import { check, summary } from './_env.mjs';
import { parseRoom, looksLikeJob } from '../../public/demo/sika-210c0c/assets/actions/job.js';
import { route } from '../../public/demo/sika-210c0c/assets/actions/parse.js';

const near = (a, b) => a != null && Math.abs(a - b) < 0.0051;
// [text, { expected fields }]
const CASES = [
  ['bathroom 2.4 x 1.8, walls to 1.8 m, over concrete', { length: 2.4, width: 1.8, floorArea: 4.32, perimeter: 8.4, height: 1.8, place: 'wet', sub: 'concrete' }],
  ['bathroom 2.4m x 1.8m walls to 1.8m over concrete', { length: 2.4, width: 1.8, height: 1.8, sub: 'concrete' }],
  ['2400 x 1800 mm ensuite, tiled to 2100 mm, on a cement screed', { length: 2.4, width: 1.8, height: 2.1, place: 'wet', sub: 'screed-render' }],
  ['2400mm by 1800mm bathroom walls 2.4 m high plasterboard', { length: 2.4, width: 1.8, height: 2.4, sub: 'plasterboard' }],
  ['laundry 3 by 2.5 m, floor only, concrete slab', { floorArea: 7.5, floorOnly: true, height: null, place: 'wet' }],
  ['shower 900 x 900 walls to 2.1 over fibre cement sheet', { length: 0.9, width: 0.9, height: 2.1, sub: 'cement-board', place: 'wet' }],
  ['bathroom 2,4 x 1,8 walls to 1,2 m on concrete', { length: 2.4, width: 1.8, height: 1.2 }],
  ['bathroom 3.2 x 2.7 m, walls to 1.8 m, over concrete, porcelain tiles', { length: 3.2, width: 2.7, tile: 'porcelain', height: 1.8, floorArea: 8.64 }],
  ['bathroom 2.4 x 1.8 over concrete', { dims: true, height: null, floorOnly: false, place: 'wet' }],
  ['bathroom 2.4 x 1.8', { dims: true, height: null, sub: null, floorSub: null }],
  ['balcony 3m x 2m on screed', { floorArea: 6, place: 'external', sub: 'screed-render' }],
  ['tiling a 4 x 3 m kitchen floor over concrete', { floorArea: 12, place: 'internal', floorOnly: true }],
  ['bathroom 2.4 x 1.8 m x 2.4 m high over concrete', { dims: true, height: 2.4 }],
  ['ensuite 2.1 * 1.5 walls to 1.8m existing tiles', { floorArea: 3.15, sub: 'existing-tiles', height: 1.8 }],
  ['bathroom 2.4 x 1.8 with a concrete floor and plasterboard walls, walls to 1.8 m', { floorSub: 'concrete', wallSub: 'plasterboard', height: 1.8 }],
  ['bathroom 2.4 x 1.8, walls are plasterboard, floor is concrete, tile to 2.1 m', { floorSub: 'concrete', wallSub: 'plasterboard', height: 2.1 }],
  ['wet room 2.0 x 2.0, walls to 2.4 m, timber floor, 10% waste', { floorArea: 4, allowance: 10, floorSub: 'timber-floor', height: 2.4 }],
  ['12 m2 bathroom floor over concrete', { dims: false, floorArea: 12, floorOnly: true }],
  ['pool 8 x 4 m, 1.5 m deep walls, concrete, mosaic', { floorArea: 32, place: 'pool', tile: 'mosaic' }],
  ['bathroom 2.4 x 1.8 walls to 1.8 m over AAC', { sub: 'aac', height: 1.8 }],
  ['bathroom 2.4 x 1.8 walls 1.8 m brick', { sub: 'masonry', height: 1.8 }],
  ['bathroom 2.4 x 1.8 m on concrete, full height walls', { dims: true, height: null, fullHeight: true }],
  ['BATHROOM 2.4 X 1.8 WALLS TO 1.8 M OVER CONCRETE', { length: 2.4, width: 1.8, height: 1.8, sub: 'concrete' }],
  ['bathroom is 2.4m wide by 1.8m long, the walls go to 1.8m, it is a concrete slab', { floorArea: 4.32 }],
  ['I want to tile my 2.4 x 1.8 m bathroom, walls up to 1.8 metres, over a concrete floor', { floorArea: 4.32, height: 1.8 }],
];
for (const [text, exp] of CASES) {
  const r = parseRoom(text);
  for (const [k, v] of Object.entries(exp)) {
    const got = r[k];
    const ok = typeof v === 'number' ? near(got, v) : got === v;
    check(`parse "${text}" -> ${k}=${v}`, ok, `got ${JSON.stringify(got)}`);
  }
}
// tile sizes and non-rooms are not jobs
for (const t of ['600 x 600 mm tiles on my bathroom floor', 'porcelain tiles 300 x 600', 'how much adhesive for 600x600 tiles', 'Davco Grey One Pot adhesive with a 10 mm notch', 'what is the pot life of SikaTile-400 EVO PRO']) {
  check(`not a job: ${t}`, !parseRoom(t).dims, JSON.stringify(parseRoom(t)));
  check(`not routed to job: ${t}`, !route(t) || route(t).action !== 'job', JSON.stringify(route(t)));
}
// routing
for (const t of ['bathroom 2.4 x 1.8, walls to 1.8 m, over concrete', '/job bathroom 2.4 x 1.8 over concrete', 'laundry 3 x 2.5 floor over concrete', 'what do I need to tile a 12 m2 bathroom floor over concrete']) {
  const r = route(t); check(`routed to job: ${t}`, r && r.action === 'job', JSON.stringify(r));
}
check('looksLikeJob rejects a bare tile size', !looksLikeJob('600 x 600 mm'));
check('a one-product quantity question stays a quantity question', route('how much primer for a 2.4 x 1.8 bathroom') === null || route('how much primer for a 2.4 x 1.8 bathroom').action !== 'job');
check('existing calc routing unchanged', route('how much Davco Grey One Pot adhesive for 20 m2').action === 'calc');
summary('t_parser');
