// Extra routes registered here, one line each (lanes add their own line).
import { selectorView } from './views-selector.js';
import { helpView } from './help.js'; // T22 problem solver
import { rulesView } from './rules.js'; // T14 rule ledger
import { insightsView } from './insights.js'; // T11 insights
import { systemDataView } from './sheet_data.js'; // T20, T21: programme and draft specification for one system sheet
export const extraRoutes = [
  [/^\/ask$/, (c) => import('./ask-system.js').then((m) => m.askView(c))], // wave 2: QR on the system sheets opens the advisor on one system
  [/^\/about\/data-quality$/, (c) => import('./data-quality.js').then((m) => m.dataQualityView(c))], // wave 2: data quality notes for Sika (the gift pack)
  [/^\/selector$/, (c) => selectorView(c)],
  [/^\/help$/, (c) => helpView(c)], // T22
  [/^\/rules$/, (c) => rulesView(c)], // T14
  [/^\/insights$/, (c) => insightsView(c)], // T11
  [/^\/system-data\/(.+)$/, (c, m) => systemDataView({ ...c, slug: decodeURIComponent(m[1]) })], // T20, T21
];
