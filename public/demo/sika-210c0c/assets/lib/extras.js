// Extra routes registered here, one line each (lanes add their own line).
import { selectorView } from './views-selector.js';
import { systemDataView } from './sheet_data.js';
export const extraRoutes = [
  [/^\/selector$/, (c) => selectorView(c)],
  [/^\/system-data\/(.+)$/, (c, m) => systemDataView({ ...c, slug: decodeURIComponent(m[1]) })],
];
