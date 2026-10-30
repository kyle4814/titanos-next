// Routes added by the finder lane. extras.js spreads this list into the router.
import { sheetView } from './sheet.js';
import { systemView } from './system.js';
export const finderRoutes = [
  [/^\/system$/, (c) => systemView(c)],
  [/^\/sheet$/, (c) => sheetView(c)],
];
