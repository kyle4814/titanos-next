// Actions v2, project memory. Demo only and this browser only: named projects holding the cart (products with quantities), saved systems,
// documents and notes, recent questions and a "my gaps" list. Since the project cart merge this is the SAME store the portal's "My projects"
// page uses (lib/projectstore.js): what the advisor adds shows on that page, and what is changed there is seen on the advisor's next turn.
// Storage is injected (localStorage in the browser); every access is wrapped in try/catch so a blocked or full store never breaks the assistant
// (it then keeps the data for this tab only and says so). Nothing is ever sent anywhere.
import { IN_BROWSER_NOTICE } from './core.js';
import { createProjectStore, KEY, LIMITS } from '../lib/projectstore.js';

export { KEY, LIMITS };

export function createMemory(storage, clock, opts) {
  const store = createProjectStore(storage, clock, { origin: 'bot', ...opts });
  const exportJSON = store.exportJSON;
  return Object.assign(store, { notice: IN_BROWSER_NOTICE, exportJSON: () => exportJSON(IN_BROWSER_NOTICE) });
}
