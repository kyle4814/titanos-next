// Extra routes registered here, one line each (lanes add their own line).
import { selectorView } from './views-selector.js';
export const extraRoutes = [
  [/^\/selector$/, (c) => selectorView(c)],
];
