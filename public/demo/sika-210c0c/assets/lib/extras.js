// Extra routes registered here, one line each (lanes add their own line).
import { selectorView } from './views-selector.js';
import { finderRoutes } from './finder/routes.js';
export const extraRoutes = [
  [/^\/selector$/, (c) => selectorView(c)],
  ...finderRoutes,
];
