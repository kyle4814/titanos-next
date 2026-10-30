// Shared paths for the quality tests. Override with env PORTAL / ASSIST / TITANOS_BIN.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const WIN = process.platform === 'win32';
// Linux paths seen from Windows node (browser tests run under node.exe because the only Chrome is the Windows one; see RECEIPT).
export const lin = (p) => (WIN && p.startsWith('/') ? '\\\\wsl.localhost\\Ubuntu' + p.replace(/\//g, '\\') : p);
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = HERE;
export const PORTAL = process.env.PORTAL || path.resolve(HERE, '../../public/demo/sika-210c0c');
export const ASSIST = process.env.ASSIST || lin('/home/tech2/klinge-kernel/state/sika/assistant');
export const KNOW = process.env.KNOW || lin('/home/tech2/klinge-kernel/state/sika/lanes/knowledge');
export const LINT_DIR = process.env.TITANOS_BIN || lin('/home/tech2/klinge-kernel/bin');
export const PW = process.env.PLAYWRIGHT_CORE || (WIN ? 'file://wsl.localhost/Ubuntu' : '') + '/home/tech2/titanos_launch/titanos-next/node_modules/playwright-core/index.mjs';
export const CHROME = process.env.CHROME_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
