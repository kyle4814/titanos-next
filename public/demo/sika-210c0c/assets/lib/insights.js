// Insights and gap list (T11), route #/insights. This browser only: nothing is sent or stored on a server.
import { h, icon, store, nf } from './util.js';
import { breadcrumb } from './components.js';
import { createInsights, gapCsv, OUTCOMES } from './insights-core.js';

export const insights = createInsights(store);
const LABEL = { ANSWERED_WITH_SOURCE: 'Answered with a source', NOT_IN_PUBLISHED_DATA: 'Not in the published data', OUT_OF_SCOPE: 'Out of scope', CLARIFY: 'Needed a clarifying question' };

export async function insightsView(ctx) {
  const root = h('div', { id: 'ins-root' });
  const draw = () => {
    const rows = insights.data().q; const gaps = insights.gaps(); const counts = insights.counts();
    const body = [];
    if (!rows.length && !insights.topViews(1).length && !insights.topCombos(1).length) {
      body.push(h('p', { id: 'ins-empty' }, 'Ask the advisor a question to see this fill in.'));
    } else {
      body.push(h('h2', { class: 'h4' }, 'Counts by outcome'),
        h('table', { class: 'table', id: 'ins-counts' }, h('tbody', null, OUTCOMES.map((o) => h('tr', null, h('th', { scope: 'row', style: 'text-transform:none;letter-spacing:0;font-size:1rem' }, LABEL[o]), h('td', null, nf.format(counts[o] || 0)))))),
        h('h2', { class: 'h4' }, 'Questions asked in this browser'),
        h('div', { class: 'table-wrap' }, h('table', { class: 'table', id: 'ins-questions' }, h('thead', null, h('tr', null, ['Date', 'Question', 'Outcome'].map((x) => h('th', { scope: 'col' }, x)))),
          h('tbody', null, rows.slice().reverse().map((r) => h('tr', { 'data-outcome': r.o }, h('td', null, r.d), h('td', null, r.t), h('td', null, LABEL[r.o])))))),
        h('h2', { class: 'h4' }, 'Gap list: questions with no published answer'),
        gaps.length ? h('ul', { id: 'ins-gaps' }, gaps.slice().reverse().map((r) => h('li', null, r.t, ' ', h('span', { class: 'count' }, r.d)))) : h('p', null, 'No gaps recorded yet.'));
      const combos = insights.topCombos(); const views = insights.topViews();
      body.push(h('h2', { class: 'h4' }, 'Most used combinations'), combos.length ? h('ul', { id: 'ins-combos' }, combos.map(([k, n]) => h('li', null, `${k}: ${nf.format(n)}`))) : h('p', null, 'None yet.'));
      body.push(h('h2', { class: 'h4' }, 'Most viewed products'), views.length ? h('ul', { id: 'ins-views' }, views.map(([k, n]) => h('li', null, h('a', { href: '#/product/' + encodeURIComponent(k) }, k), `: ${nf.format(n)}`))) : h('p', null, 'None yet.'));
    }
    const exp = h('button', { class: 'btn', type: 'button', id: 'ins-export', disabled: !gaps.length || null }, icon('file', 'i--sm'), ' Export gap list (CSV)');
    exp.addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([gapCsv(insights.gaps())], { type: 'text/csv;charset=utf-8' }));
      const a = h('a', { href: url, download: 'sika-demo-gap-list.csv' }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    const clr = h('button', { class: 'btn btn--text', type: 'button', id: 'ins-clear' }, 'Clear');
    clr.addEventListener('click', () => { insights.clear(); draw(); });
    root.replaceChildren(...body, h('div', { class: 'opts' }, exp, clr));
  };
  draw(); insights.onChange(() => { if (root.isConnected) draw(); });
  const el = h('div', { class: 'container' }, breadcrumb([{ label: 'Home', href: '#/' }, { label: 'Insights and gap list' }]),
    h('div', { class: 'page-head' }, h('h1', null, 'Insights and gap list')),
    h('div', { class: 'prose', style: 'max-width:52rem' },
      h('div', { class: 'notice' }, icon('info'), h('span', { id: 'ins-banner' }, 'This shows this browser only. On a live portal Sika would see the same view across all visitors, as counts only, with no personal information.')),
      root));
  return { el, title: 'Insights and gap list', nav: null };
}
