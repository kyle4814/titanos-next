// Shared paths for the citematch tests. Override with env PORTAL.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PORTAL = process.env.PORTAL || path.resolve(HERE, '../../public/demo/sika-210c0c');
