// plansave.js: what "Add the plan to my project" saves, through the shared project store (lib/projectstore.js). Small on purpose: it is bundled with the panel,
// while the plan engine (rules.js) is loaded on demand.
/** Saves the system with its steps, its documents and a note with the timeline. `store` is a project store; `commit` is card.plan.commit from rules.js. */
export function commitPlan(store, commit) {
  if (!store || !commit) return { ok: false, error: 'There is no plan to save.' };
  const r = { system: store.saveSystem({ title: commit.title, slug: commit.slug, env: commit.env, tile: commit.tile, substrate: commit.substrate, steps: commit.steps }), documents: [], note: null };
  for (const d of commit.documents || []) r.documents.push(store.saveDocument(d));
  r.note = store.addNote(commit.note);
  r.ok = true; return r;
}
