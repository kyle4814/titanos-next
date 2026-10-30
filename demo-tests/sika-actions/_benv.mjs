// Paths for the browser test (Windows node, the only Chrome here is the Windows one).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const WIN = process.platform === 'win32';
export const lin = (p) => (WIN && p.startsWith('/') ? '\\\\wsl.localhost\\Ubuntu' + p.replace(/\//g, '\\') : p);
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PORTAL = process.env.PORTAL || path.resolve(HERE, '../../public/demo/sika-210c0c');
export const PW = process.env.PLAYWRIGHT_CORE || (WIN ? 'file://wsl.localhost/Ubuntu' : '') + '/home/tech2/titanos_launch/titanos-next/node_modules/playwright-core/index.mjs';
export const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
