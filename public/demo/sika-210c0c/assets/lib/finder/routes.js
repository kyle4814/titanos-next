// Routes added by the finder lane. extras.js spreads this list into the router.
import { sheetView } from './sheet.js';
export const finderRoutes = [
  [/^\/sheet$/, (c) => sheetView(c)],
];
