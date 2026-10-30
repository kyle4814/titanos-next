// Boot loader: the bundled build when it can be fetched, the readable modules otherwise (offline, or a host without dist/).
import('../dist/main.js').catch(() => import('./app.js'));
