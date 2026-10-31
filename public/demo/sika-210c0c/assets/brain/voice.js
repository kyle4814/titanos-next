// voice.js: the assistant's voice. Deterministic templates, no model, no network. Sika-calm, plain Australian English, warm, first person, one frame.
// Shape of every spoken answer: the recommendation or the fact first, then the reason, then the source (the card), then the next step as chips.
// Templates carry no figures of their own (a number may only appear inside a cited fact), so a job text with digits is left out of the sentence.
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const plainJob = (job) => { const j = clean(job); return j && !/\d/.test(j) ? j : ''; };
export const RECOMMEND_CHIP = 'Recommend one for me';
export const TECH_ROUTE = { label: 'Ask Sika Technical Services', url: 'https://aus.sika.com/en/Contact/technical.html' };

/** The opening line of a recommendation: the pick first, then the reason (its own published text documents a fit). */
export function pick(name, job, others = []) {
  const j = plainJob(job);
  const alt = others.length ? ` If it does not suit, ${others.slice(0, 2).join(' and ')} ${others.length > 1 ? 'are' : 'is'} next in line.` : '';
  return `I would start with ${name}. Its own published text documents a fit for the job${j ? ` you described (${j})` : ''}, and the source is under the card.${alt}`;
}
/** Said when the recommendation was asked for without a job: ask once, offer the common jobs as chips. */
export function askJob() {
  return { title: 'Happy to pick one. What is the job?', headline: 'Tell me what you are working on and I will name the product whose published text documents a fit. A few common ones to tap:' };
}
/** Said when a range was asked for without a condition: honest, and the one question that unlocks a pick. */
export function needCondition() { return 'I will not pick blind. Tell me where it goes (inside, outside, wet area) or the surface, and I will name the one whose published text documents that fit.'; }
/** The bridge between a recommendation and the thing the visitor first asked for ("and here is the quantity for it"). */
export function bridge(kind) {
  return { calc: 'Here is the quantity for that product, worked out from its own published rate.', rate: 'Here is its published coverage.', time: 'Here are its published times.', document: 'Here are its documents.', safety: 'Here is its safety information.', spec: 'Here are its specification clauses.' }[kind] || 'Here are the details.';
}
/** A refusal is never bare: what is not published, the nearest thing that is, and the route to a person. */
export function notPublished(what, alt) {
  return `${clean(what) || 'That'} is not in the published documentation I work from, so I will not guess it.${alt ? ` The nearest thing that is published: ${clean(alt)}.` : ''} Sika Technical Services can answer it.`;
}
export function followUpLead(kind) {
  return { area: 'Same product, new area:', pack: 'Pack sizes for the same product:', ordinal: 'That one:', back: 'Going back:' }[kind] || '';
}
