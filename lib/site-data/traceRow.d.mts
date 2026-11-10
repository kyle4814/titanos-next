export function traceRow(row: Record<string, unknown>, loadSource: (path: string) => unknown): string[];
export function isUnknownRow(row: Record<string, unknown>): boolean;
export function sourceRowOf(src: unknown, sourceRow: string): { text: string; dates: string[] } | null;
