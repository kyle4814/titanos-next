// Shared paths for the quality tests. Override with env PORTAL / ASSIST / TITANOS_BIN.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = HERE;
export const PORTAL = process.env.PORTAL || path.resolve(HERE, '../../public/demo/sika-210c0c');
export const ASSIST = process.env.ASSIST || '/home/tech2/klinge-kernel/state/sika/assistant';
export const KNOW = process.env.KNOW || '/home/tech2/klinge-kernel/state/sika/lanes/knowledge';
export const LINT_DIR = process.env.TITANOS_BIN || '/home/tech2/klinge-kernel/bin';
