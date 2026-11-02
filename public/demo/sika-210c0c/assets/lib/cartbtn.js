// cartbtn.js: "Add 3 x 2 L pails to my quote" under a computed quantity answer. Adds exactly that pack and count to the shared project store
// (lib/projectstore.js, the same cart "My projects and quotes" shows); no new storage. The store is fetched when the button is pressed.
import { h } from './util.js';
export function cartButtons(options) {
  const msg = h('span', { role: 'status', class: 'cart-msg' });
  const btns = (options || []).map((o) => {
    const b = h('button', { class: 'chip', type: 'button', 'data-cart': o.id }, o.label);
    b.addEventListener('click', async () => {
      try {
        const { createProjectStore, sharedStorage } = await import('./projectstore.js');
        const r = createProjectStore(sharedStorage(), null, { origin: 'portal' }).addItem({ id: o.id, name: o.name, qty: o.qty, unit: o.unit, packs: o.packs, need: o.need, job: o.job, url: o.url, phrase: o.phrase, basis: 'Worked out in the advisor', question: 'Advisor quantity answer' });
        msg.textContent = r && r.ok ? ` ${o.label.replace(/^Add /, 'Added ').replace(' to my quote', ' to your quote')}. ` : ' Could not add it to your quote.';
        if (r && r.ok) msg.append(h('a', { href: '#/projects' }, 'See my quote'));
      } catch { msg.textContent = ' Could not add it to your quote.'; }
    });
    return b;
  });
  return btns.length ? h('p', { class: 'opts cart-opts' }, ...btns, msg) : null;
}

/** What a quantity answer still offers under its card: chips for the product, tile or joint options it needs, then the add-to-quote buttons. */
export function calcExtras(c, send) {
  const out = []; const ch = send ? (c.followups || []).filter((f) => /^How much /.test(f)) : [];
  if (ch.length) out.push(h('div', { class: 'opts' }, ch.map((f) => h('button', { class: 'chip', type: 'button', onclick: () => send(f, f) }, f.replace(/^How much /, '')))));
  const cb = c.cart ? cartButtons(c.cart) : null; if (cb) out.push(cb);
  return out.length ? out : [h('span')];
}
