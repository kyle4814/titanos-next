// Project memory: save, reload, export, import, blocked storage, hostile import, the in-browser notice, recent questions, gaps.
import { makeAssistant, ask, check, summary, memStorage } from './_env.mjs';
import { createMemory, KEY, LIMITS } from '../../public/demo/sika-210c0c/assets/actions/memory.js';
import { IN_BROWSER_NOTICE } from '../../public/demo/sika-210c0c/assets/actions/core.js';

const OLD = 'Davco Grey One Pot adhesive';
const clock = () => new Date('2026-10-30T10:00:00Z');

// round trip: save in one "page load", reload (new memory over the same storage), find everything
{
  const st = memStorage(); const A = makeAssistant({ storage: st });
  await ask(A, '/new Smith bathroom');
  await ask(A, '/system porcelain on concrete, inside'); const s1 = await ask(A, '/save');
  check('save system ok', s1.card.title === 'Saved to my project' && s1.card.rows[0].value === 'Smith bathroom');
  await ask(A, `/calc 20 m2 ${OLD} 6 mm notch`); await ask(A, '/save');
  await ask(A, '/note tiler wants the grout colour confirmed');
  await ask(A, `/pack ${OLD}`); await ask(A, '/save');
  const B = makeAssistant({ storage: st }); // reload
  const pr = B.memory.currentProject();
  check('reload: project name', pr && pr.name === 'Smith bathroom');
  check('reload: system saved', pr.systems.length === 1 && /porcelain/.test(pr.systems[0].title));
  check('reload: quantity saved with its phrase', pr.quantities.length === 1 && /cover approximately 7\.5m2/.test(pr.quantities[0].rows[0].phrase) && Math.abs(pr.quantities[0].rows[0].low - 26.67) < 0.01);
  check('reload: note saved', pr.notes.length === 1 && /grout colour/.test(pr.notes[0].text));
  check('reload: documents saved', pr.documents.length >= 1 && pr.documents.every((d) => /^https:\/\/aus\.sika\.com\//.test(d.url)));
  check('reload: loaded from storage', B.memory.loadedFrom() === 'storage');
  // projects card shows them
  const pc = await ask(B, 'show my projects');
  check('projects card lists the project', pc.card.rows.some((r) => /Smith bathroom/.test(r.label)) && pc.card.notice === IN_BROWSER_NOTICE);
  check('projects card has the saved sections', pc.card.sections.length >= 3);
  // export then import into a clean browser
  const ex = await ask(B, '/exportjson');
  const json = ex.card.exports[0].text;
  check('export is valid json with a version', JSON.parse(json).v === 1);
  check('export carries the notice', JSON.parse(json).note === IN_BROWSER_NOTICE);
  const C = makeAssistant({ storage: memStorage() });
  const imp = C.memory.importJSON(json);
  check('import ok', imp.ok && imp.projects === 1);
  const cp = C.memory.currentProject();
  check('import: same contents', JSON.stringify(cp.systems) === JSON.stringify(pr.systems) && JSON.stringify(cp.quantities) === JSON.stringify(pr.quantities) && JSON.stringify(cp.notes) === JSON.stringify(pr.notes));
  check('import twice does not duplicate', (C.memory.importJSON(json), C.memory.currentProject().quantities.length === 1 && C.memory.currentProject().systems.length === 1));
  const D = makeAssistant({ storage: C.storage });
  check('import persisted', D.memory.currentProject() && D.memory.currentProject().name === 'Smith bathroom');
  // import through the chat command
  const E = makeAssistant({ storage: memStorage() });
  const ic = await ask(E, '/import'); check('import command offers a box', ic.card.importBox === true);
}

// the notice
{
  const A = makeAssistant();
  for (const q of ['/projects', '/gaps', '/recent', '/new Test', '/exportjson']) { const r = await ask(A, q); check(`notice on ${q}`, r.card.notice === IN_BROWSER_NOTICE && /this browser only/.test(r.card.notice) && /Nothing is sent anywhere/.test(r.card.notice)); }
}

// recent questions and gaps
{
  const A = makeAssistant();
  await ask(A, `/safety ${OLD}`); await ask(A, `open time of ${OLD}`);
  check('recent has both', A.memory.recent().length === 2 && A.memory.recent()[0].q.startsWith('open time'));
  await ask(A, 'how much SikaBond PVA for 5 m2'); // no published rate: a gap
  check('gap recorded for an unanswerable question', A.memory.gaps().some((g) => /SikaBond PVA/.test(g.q)));
  await ask(A, 'how much SikaBond PVA for 5 m2');
  check('gap counted not duplicated', A.memory.gaps().filter((g) => /SikaBond PVA/.test(g.q)).length === 1 && A.memory.gaps()[0].count === 2);
  const g = await ask(A, 'my gaps'); check('gaps card', g.card.rows.length === 1 && /asked 2 times/.test(g.card.rows[0].value));
  await ask(A, '/clear gaps'); check('gaps cleared', A.memory.gaps().length === 0);
  const r = await ask(A, 'recent questions'); check('recent card', r.card.rows.length >= 2);
}

// storage that throws never breaks anything
{
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('blocked'); } };
  const A = makeAssistant({ storage: bad });
  let threw = false;
  try { await ask(A, '/new X'); await ask(A, `/calc 20 m2 ${OLD} 6 mm notch`); const s = await ask(A, '/save'); check('blocked storage: save says tab only', /this tab only/.test(s.card.notes.join(' '))); await ask(A, '/projects'); } catch { threw = true; }
  check('blocked storage never throws', !threw);
  check('blocked storage: not persistent', A.memory.persistent() === false);
  check('blocked storage: still remembered in the tab', A.memory.currentProject() && A.memory.currentProject().quantities.length === 1);
  const nul = createMemory(null, clock); nul.addNote('hello'); check('null storage works', nul.currentProject().notes.length === 1 && !nul.persistent());
  const junk = memStorage(); junk.setItem(KEY, '{not json'); const j = createMemory(junk, clock); check('corrupt storage starts empty', j.list().length === 0);
  const wrong = memStorage(); wrong.setItem(KEY, JSON.stringify({ v: 9, projects: {} })); check('unknown version ignored', createMemory(wrong, clock).list().length === 0);
}

// hostile imports
{
  const M = createMemory(memStorage(), clock);
  check('import: not json', !M.importJSON('{oops').ok);
  check('import: wrong shape', !M.importJSON('[1,2]').ok);
  check('import: wrong version', !M.importJSON(JSON.stringify({ v: 2, projects: {} })).ok);
  check('import: no projects', !M.importJSON(JSON.stringify({ v: 1 })).ok);
  const many = {}; for (let i = 0; i < LIMITS.projects + 5; i++) many['p' + i] = {};
  check('import: too many projects refused', !M.importJSON(JSON.stringify({ v: 1, projects: many })).ok);
  const proto = M.importJSON('{"v":1,"projects":{"__proto__":{"notes":[{"text":"x"}]},"constructor":{},"ok":{"notes":[{"text":"<img src=x onerror=alert(1)> " }]}}}');
  check('import: proto keys dropped', proto.ok && !({}).notes && Object.keys(M.state().projects).join() === 'ok');
  check('import: markup kept as plain text only', M.state().projects.ok.notes[0].text.includes('<img') === true); // text is rendered with textContent, never as HTML; the UI test checks that
  const long = 'x'.repeat(5000); M.importJSON(JSON.stringify({ v: 1, projects: { Long: { notes: [{ text: long }] } } }));
  check('import: long text clipped', M.state().projects.Long.notes[0].text.length <= LIMITS.text);
  M.importJSON(JSON.stringify({ v: 1, projects: { N: { quantities: [{ productId: 'a', name: 'b', job: { area: 5, evil: { x: 1 } }, rows: [{ low: 'NaN', high: 2, unit: 'L' }] }] } } }));
  check('import: nested junk dropped, numbers coerced', JSON.stringify(M.state().projects.N.quantities[0].job) === '{"area":5}' && M.state().projects.N.quantities[0].rows[0].low === 0);
  const rep = createMemory(memStorage(), clock); rep.create('Keep'); rep.addNote('keep me'); rep.importJSON(JSON.stringify({ v: 1, projects: { Other: {} } }), { merge: false });
  check('import: replace mode replaces', Object.keys(rep.state().projects).join() === 'Other');
}

// limits and naming
{
  const M = createMemory(memStorage(), clock);
  for (let i = 0; i < LIMITS.projects; i++) M.create('P' + i);
  check('project cap', !M.create('one too many').ok);
  check('use unknown project', !M.use('nope').ok);
  check('use is case insensitive', M.use('p3').ok && M.current() === 'P3');
  for (let i = 0; i < LIMITS.perList + 20; i++) M.addNote('n' + i);
  check('list cap', M.currentProject().notes.length === LIMITS.perList);
  for (let i = 0; i < LIMITS.recent + 10; i++) M.rememberQuestion('q' + i, 'ask');
  check('recent cap', M.recent().length === LIMITS.recent);
  check('empty note refused', !M.addNote('   ').ok);
  M.clearAll(); check('clear all', M.list().length === 0 && M.recent().length === 0);
}
summary('t_memory');
